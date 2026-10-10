from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette import status
from src.models import Application

#функция для диагностки(status_info), отметить диагностику может только мастер диагностики, который взял заявку
#with_for_update блокирует заявку, чтобы повторный параллельный запрос не отметил диагностику второй раз
def perform_diagnostics(aplication_id:int, employee_id: int, diagnostic_info: str, db:Session):
    application=db.query(Application).filter(Application.id==aplication_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={aplication_id} не найдена"
        )

    if application.status_info is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить действие: у заявки с id={aplication_id} не задан статус",
        )
    elif application.status_info != 0:
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
    application.status_info+=1
    application.diagnostic_result=diagnostic_info
    application.status='Диагностика завершена, Ожидание выполнения работы...'
    db.commit()
    db.refresh(application)
    return application

#функция назначения мастера(диагносткии) на заявку
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
    if application.status_info!=0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Заявка с id={application_id} уже прошла этап диагностики'
        )

    application.assignee_engineer_id = employee_id
    application.status='Заявка взята в диагностику . Ожидается выполнение...'
    db.commit()
    db.refresh(application)
    return application
