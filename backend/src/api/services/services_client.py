import re
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.api.services.services import build_application
from src.models import Application, Client
from src.shemas import ClientApplicationCreateShema
from src.api.roles.operator import phone_operator

# Поиск заявки по коду.
def status_client(db: Session, application_code: str | None = None):
    if (application_code is None):
        raise HTTPException(status_code=422, detail="Введите код заявки")
    #код - 8 латинских букв и цифр, генерируется заглавными. остальное (в т.ч. \x00, который Postgres не принимает) - сразу 422
    application_code = application_code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{8}", application_code):
        raise HTTPException(status_code=422, detail="Код заявки - 8 латинских букв и цифр")
    code=db.query(Application).filter(Application.code == application_code).first()
    if code is None:
        raise HTTPException(status_code=404,detail='Введен неверый код')
    if code is not None:
        message = f"Здравствуйте, {code.FIO}! Ваша заявка находится в статусе: {code.status}  Номер телефона для связи с оператором {phone_operator}"
        return message


#клиент сам создает заявку: ФИО, телефон и email берутся из его аккаунта
def create_client_application(client: Client, data: ClientApplicationCreateShema, db: Session, retry: bool = True) -> Application:
    application = build_application(client, data)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        #совпал случайный код заявки, пробуем еще раз с новым
        db.rollback()
        if not retry:
            raise
        return create_client_application(client, data, db, retry=False)
    db.refresh(application)
    return application


#все заявки клиента, новые сверху
def get_client_own_applications(client: Client, db: Session):
    return (
        db.query(Application)
        .filter(Application.client_id == client.id)
        .order_by(Application.created_at.desc(), Application.id.desc())
        .all()
    )
