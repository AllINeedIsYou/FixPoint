from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette import status
from src.models import (Application, Stage, STATUS_DIAGNOSTICS_TAKEN, STATUS_DIAGNOSED, STATUS_CHECKED,
                        STATUS_CHECK_FAILED)

#функция для диагностики(status_info), отметить диагностику может только мастер диагностики, который взял заявку
#with_for_update блокирует заявку, чтобы повторный параллельный запрос не отметил диагностику второй раз
def perform_diagnostics(aplication_id:int, employee_id: int, diagnostic_info: str, db:Session):
    application=db.query(Application).filter(Application.id==aplication_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={aplication_id} не найдена"
        )

    if application.status_info is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить действие: у заявки с id={aplication_id} не задан статус",
        )
    elif application.status_info != Stage.CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить диагностику: заявка с id={aplication_id} уже прошла этап диагностики",
        )
    if application.assignee_engineer_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={aplication_id} не взята в диагностику, сначала возьмите её",
        )
    if application.assignee_engineer_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Заявка с id={aplication_id} назначена другому мастеру диагностики",
        )
    application.status_info=Stage.DIAGNOSED
    application.diagnostic_result=diagnostic_info
    application.status=STATUS_DIAGNOSED
    db.commit()
    db.refresh(application)
    return application

#функция назначения мастера(диагностики) на заявку
#with_for_update блокирует строку заявки, чтобы два инженера не забронировали ее одновременно
def take_engineer_application(application_id: int, employee_id: int, db: Session):
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if application.assignee_engineer_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} уже назначена другому мастеру диагностики"
        )
    #бронь без инженера на проверке бывает, если оператор снял с нее уволенного инженера
    if application.status_info not in (Stage.CREATED, Stage.REPAIRED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Заявка с id={application_id} сейчас не ждет ни диагностики, ни проверки'
        )

    application.assignee_engineer_id = employee_id
    if application.status_info == Stage.CREATED:
        application.status=STATUS_DIAGNOSTICS_TAKEN
    db.commit()
    db.refresh(application)
    return application

#инженер отказывается от забронированной заявки (до завершения диагностики), ее может взять другой инженер
def release_engineer_application(application_id: int, employee_id: int, db: Session):
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if application.status_info not in (Stage.CREATED, Stage.REPAIRED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно снять бронь: заявка с id={application_id} сейчас не на диагностике и не на проверке"
        )
    if application.assignee_engineer_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} не забронирована"
        )
    if application.assignee_engineer_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Заявка с id={application_id} назначена другому мастеру диагностики"
        )

    application.assignee_engineer_id = None
    if application.status_info == Stage.CREATED:
        application.status = application.waiting_diagnostics_status()
    db.commit()
    db.refresh(application)
    return application


#инженер, который диагностировал заявку, проверяет ремонт:
#пройдена - устройство готово к выдаче, не пройдена - заявка уходит на повторную диагностику
def check_repair(application_id: int, employee_id: int, passed: bool, comment: str | None, db: Session):
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if application.status_info in (Stage.CHECKED, Stage.ISSUED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ремонт по заявке с id={application_id} уже проверен"
        )
    if application.status_info != Stage.REPAIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно проверить: ремонт по заявке с id={application_id} еще не завершён"
        )
    if application.assignee_engineer_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} не взята на проверку, сначала возьмите её"
        )
    if application.assignee_engineer_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Проверить ремонт может только инженер заявки с id={application_id}"
        )

    application.check_result = comment
    if passed:
        application.status_info = Stage.CHECKED
        application.status = STATUS_CHECKED
    else:
        #списанные запчасти остаются в заявке: они уже поставлены в устройство
        application.status_info = Stage.CREATED
        application.status = STATUS_CHECK_FAILED
        application.assignee_engineer_id = None
        application.assignee_repairer_id = None
    db.commit()
    db.refresh(application)
    return application
