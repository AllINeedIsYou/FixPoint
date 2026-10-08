from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette import status

from src.models import Application, Part
from src.shemas import PartCreateShema

#функция для работы(status_info)
def repair_info(application_id:int,db:Session):
    repair_id=db.query(Application).filter(Application.id==application_id).first()
    if not repair_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if repair_id.status_info is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить действие: у заявки с id={application_id} не задан статус",
        )
    elif repair_id.status_info < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить ремонт: заявка с id={application_id} не прошла этап диагностики",
        )
    elif repair_id.status_info > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выполнить ремонт: ремонт по заявке с id={application_id} уже завершён",
        )
    if repair_id.assignee_repairer_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} не взята в работу, сначала возьмите её",
        )
    # if repair_id.assignee_repairer_id != employee_id:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail=f"Заявка с id={application_id} назначена другому мастеру",
    #     )
    repair_id.status_info+=1
    repair_id.status='Работы завершина. Ожидание выдачи клиенту'
    db.commit()
    db.refresh(repair_id)
    return repair_id


#функция добавления запчасти в заявку (стоимость заявки считается суммой запчастей)
def add_part(application_id: int, part_data: PartCreateShema, db: Session):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )

    new_part = Part(
        application_id=application_id,
        name=part_data.name,
        price=part_data.price,
        quantity=part_data.quantity,
    )

    db.add(new_part)
    db.commit()
    db.refresh(application)
    return application


#функция удаления ошибочно добавленной запчасти
def delete_part(application_id: int, part_id: int, db: Session):
    part = (
        db.query(Part)
        .filter(Part.id == part_id, Part.application_id == application_id)
        .first()
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запчасть с id={part_id} не найдена у заявки с id={application_id}"
        )

    application = part.application
    db.delete(part)
    db.commit()
    db.refresh(application)
    return application


#функция назначения мастера на заявку
def take_repairer_application(application_id: int, employee_id: int, db: Session):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if application.assignee_repairer_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} уже назначена другому мастеру"
        )
    if application.status_info<1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Заявка с id={application_id} еще не прошла этап диагностики'
        )

    application.assignee_repairer_id = employee_id
    application.status='Заявка взята в работу. Ожидается выполнение...'
    db.commit()
    db.refresh(application)
    return application