from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette import status

from src.models import (Application, Client, Stage, STATUS_DIAGNOSED, STATUS_ISSUED,
                        STATUS_COURIER_DISPATCHED, STATUS_COURIER_PICKED_UP, STATUS_ARRIVED)
from src.application_flow import ApplicationSource, DeliveryStatus
from src.shemas import ApplicationCreateShema
from src.api.services.services import build_application

def _same_person(client: Client, FIO: str, email: str) -> bool:
    return client.FIO.strip().casefold() == FIO.strip().casefold() and client.email.lower() == email.lower()


#создание заявки: клиент ищется по телефону, нового клиента создаем.
#если телефон уже есть, но ФИО или email другие - 400, оператор должен разобраться сам
def create_application(data: ApplicationCreateShema, db: Session, retry: bool = True) -> Application:
    number = str(data.number)
    email = str(data.email)
    client = db.query(Client).filter(Client.number == number).first()
    if client is None:
        client = Client(FIO=data.FIO.strip(), number=number, email=email)
        db.add(client)
    elif not _same_person(client, data.FIO, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Клиент с телефоном {number} уже есть (id={client.id}): {client.FIO}, {client.email}. "
                   f"Проверьте ФИО и email или укажите другой телефон"
        )

    application = build_application(client, data)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        #параллельный запрос успел создать клиента с этим телефоном (или совпал код заявки), повторяем
        db.rollback()
        if not retry:
            raise
        return create_application(data, db, retry=False)
    db.refresh(application)
    return application


#список клиентов, поиск по части ФИО или телефона
def get_clients(db: Session, search: str | None = None):
    query = db.query(Client)
    if search:
        condition = func.lower(Client.FIO).contains(search.strip().lower(), autoescape=True)
        #телефон хранится как tel:+7-916-123-45-67, ищем по цифрам без дефисов
        digits = "".join(ch for ch in search if ch.isdigit())
        if digits:
            condition = condition | func.replace(Client.number, "-", "").contains(digits)
        query = query.filter(condition)
    return query.order_by(Client.id).all()


#все заявки клиента
def get_client_applications(client_id: int, db: Session):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиент с id={client_id} не найден"
        )
    return client.applications


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
    return {'status':'success', 'message': f"Заявка с id={aplication_id} успешно удалена"}


#заявка для действий оператора, with_for_update блокирует ее, чтобы параллельные запросы шли по очереди
def get_application_for_update(application_id: int, db: Session) -> Application:
    application = db.query(Application).filter(Application.id == application_id).with_for_update().first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена"
        )
    return application


def update_delivery(application_id: int, target: str, db: Session) -> Application:
    application = get_application_for_update(application_id, db)
    if application.source != ApplicationSource.ONLINE:
        raise HTTPException(status_code=400, detail="Этапы курьера доступны только для онлайн-заявок")
    if application.next_delivery_status != target:
        raise HTTPException(status_code=409, detail="Этап доставки уже изменён или нарушен порядок. Обновите заявку и выберите следующий доступный шаг.")
    stages = {
        DeliveryStatus.COURIER_DISPATCHED: (Stage.COURIER_DISPATCHED, STATUS_COURIER_DISPATCHED),
        DeliveryStatus.COURIER_PICKED_UP: (Stage.COURIER_PICKED_UP, STATUS_COURIER_PICKED_UP),
        DeliveryStatus.ARRIVED: (Stage.CREATED, STATUS_ARRIVED),
    }
    application.status_info, application.status = stages[target]
    db.commit()
    db.refresh(application)
    return application


def get_delivery_queue(db: Session, delivery_status: DeliveryStatus | None = None):
    query = db.query(Application).filter(Application.source == ApplicationSource.ONLINE)
    stages = {
        DeliveryStatus.CREATED: Stage.ONLINE_CREATED,
        DeliveryStatus.COURIER_DISPATCHED: Stage.COURIER_DISPATCHED,
        DeliveryStatus.COURIER_PICKED_UP: Stage.COURIER_PICKED_UP,
    }
    if delivery_status == DeliveryStatus.ARRIVED:
        query = query.filter(Application.status_info >= Stage.CREATED)
    elif delivery_status is not None:
        query = query.filter(Application.status_info == stages[delivery_status])
    else:
        query = query.filter(Application.status_info < Stage.CREATED)
    return query.order_by(Application.courier_visit_at.asc(), Application.id.asc()).all()


#выдача устройства клиенту, возможна только после пройденной проверки ремонта
def issue_application(application_id: int, db: Session):
    application = get_application_for_update(application_id, db)
    if application.status_info == Stage.ISSUED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Устройство по заявке с id={application_id} уже выдано клиенту"
        )
    if application.status_info == Stage.REPAIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выдать устройство: ремонт по заявке с id={application_id} еще не проверен инженером"
        )
    if application.status_info != Stage.CHECKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно выдать устройство: ремонт по заявке с id={application_id} еще не завершён"
        )

    application.status_info = Stage.ISSUED
    application.status = STATUS_ISSUED
    db.commit()
    db.refresh(application)
    return application


