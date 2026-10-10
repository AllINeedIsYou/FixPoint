from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette import status

from src.models import Application, Part, StockPart, Stage, STATUS_DIAGNOSED, STATUS_REPAIR_TAKEN, STATUS_REPAIRED
from src.shemas import PartCreateShema


#заявка, с которой мастер может работать прямо сейчас:
#диагностика пройдена, ремонт не завершен, заявку взял именно этот мастер.
#with_for_update блокирует заявку до конца запроса, чтобы параллельные запросы по ней шли по очереди
#(иначе одна запчасть удалялась дважды и дважды возвращалась на склад)
def get_application_in_repair(application_id: int, employee_id: int, db: Session, action: str) -> Application:
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    if application.status_info < Stage.DIAGNOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно {action}: заявка с id={application_id} не прошла этап диагностики",
        )
    if application.status_info > Stage.DIAGNOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно {action}: ремонт по заявке с id={application_id} уже завершён",
        )
    if application.assignee_repairer_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} не взята в работу, сначала возьмите её",
        )
    if application.assignee_repairer_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Заявка с id={application_id} назначена другому мастеру",
        )
    return application


#функция для работы(status_info)
def repair_info(application_id:int,employee_id:int,db:Session):
    repair_id = get_application_in_repair(application_id, employee_id, db, action="выполнить ремонт")
    repair_id.status_info=Stage.REPAIRED
    repair_id.status=STATUS_REPAIRED
    db.commit()
    db.refresh(repair_id)
    return repair_id


#мастер списывает запчасть со склада на заявку, цена берется со склада
def add_part(application_id: int, employee_id: int, part_data: PartCreateShema, db: Session):
    application = get_application_in_repair(application_id, employee_id, db, action="добавить запчасть")

    name = part_data.name.strip()
    stock_part = (
        db.query(StockPart)
        .filter(func.lower(StockPart.name) == name.lower())
        .with_for_update()
        .first()
    )
    if not stock_part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запчасти '{name}' нет на складе"
        )
    if stock_part.quantity < part_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно на складе: '{stock_part.name}' осталось {stock_part.quantity} шт., нужно {part_data.quantity}"
        )

    stock_part.quantity -= part_data.quantity
    new_part = Part(
        application_id=application_id,
        stock_part_id=stock_part.id,
        name=stock_part.name,
        price=stock_part.price,
        quantity=part_data.quantity,
    )

    db.add(new_part)
    db.commit()
    db.refresh(application)
    return application


#удаление ошибочно добавленной запчасти, количество возвращается на склад
def delete_part(application_id: int, part_id: int, employee_id: int, db: Session):
    get_application_in_repair(application_id, employee_id, db, action="удалить запчасть")
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

    if part.stock_part_id is not None:
        stock_part = (
            db.query(StockPart)
            .filter(StockPart.id == part.stock_part_id)
            .with_for_update()
            .first()
        )
        if stock_part:
            stock_part.quantity += part.quantity

    application = part.application
    db.delete(part)
    db.commit()
    db.refresh(application)
    return application


#функция назначения мастера на заявку
#with_for_update блокирует строку заявки, чтобы два мастера не взяли ее одновременно
def take_repairer_application(application_id: int, employee_id: int, db: Session):
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
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
    if application.status_info<Stage.DIAGNOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Заявка с id={application_id} еще не прошла этап диагностики'
        )
    if application.status_info>Stage.DIAGNOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ремонт по заявке с id={application_id} уже завершён'
        )

    application.assignee_repairer_id = employee_id
    application.status=STATUS_REPAIR_TAKEN
    db.commit()
    db.refresh(application)
    return application


#мастер отказывается от взятой заявки (до завершения ремонта), ее может взять другой мастер.
#списанные запчасти остаются в заявке
def release_repairer_application(application_id: int, employee_id: int, db: Session):
    application = get_application_in_repair(application_id, employee_id, db, action="отказаться от заявки")
    application.assignee_repairer_id = None
    application.status = STATUS_DIAGNOSED
    db.commit()
    db.refresh(application)
    return application
