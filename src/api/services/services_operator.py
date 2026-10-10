from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette import status

from src.models import Application, Stage, STATUS_CREATED, STATUS_DIAGNOSED, STATUS_ISSUED

#функция для удаление заявки
def del_elements_aplication_by_id(aplication_id:int,db:Session):
    app_to_del=db.query(Application).filter(Application.id==aplication_id).first()
    if not app_to_del:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={aplication_id} не найдена"
        )
    db.delete(app_to_del)
    db.commit()
    return {'status':'success', 'massage': f"Заявка с id={aplication_id} успешно удалена"}


#заявка для действий оператора, with_for_update блокирует ее, чтобы параллельные запросы шли по очереди
def get_application_for_update(application_id: int, db: Session) -> Application:
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    return application


#выдача устройства клиенту, возможна только после завершения ремонта
def issue_application(application_id: int, db: Session):
    application = get_application_for_update(application_id, db)
    if application.status_info == Stage.ISSUED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Устройство по заявке с id={application_id} уже выдано клиенту"
        )
    if application.status_info != Stage.REPAIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выдать устройство: ремонт по заявке с id={application_id} еще не завершён"
        )

    application.status_info = Stage.ISSUED
    application.status = STATUS_ISSUED
    db.commit()
    db.refresh(application)
    return application


#оператор снимает бронь с заявки, если сотрудник не может ее выполнить (заболел, уволился):
#на диагностике снимается инженер, на ремонте мастер. после этого заявку может взять другой сотрудник
def release_application(application_id: int, db: Session):
    application = get_application_for_update(application_id, db)
    if application.status_info == Stage.CREATED and application.assignee_engineer_id is not None:
        application.assignee_engineer_id = None
        application.status = STATUS_CREATED
    elif application.status_info == Stage.DIAGNOSED and application.assignee_repairer_id is not None:
        application.assignee_repairer_id = None
        application.status = STATUS_DIAGNOSED
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} сейчас никем не забронирована"
        )

    db.commit()
    db.refresh(application)
    return application
