from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from src.models import Application
from src.api.roles.operator import phone_operator

# Поиск заявки по коду.
def status_client(db: Session, application_code: str | None = None):
    if (application_code is None):
        raise HTTPException(status_code=422, detail="Введите код заявки")
    code=db.query(Application).filter(Application.code == application_code).first()
    if code is None:
        raise HTTPException(status_code=404,detail='Введен неверый код')
    if code is not None:
        message = f"Здравствуйте, {code.FIO}! Ваша заявка находится в статусе: {code.status}  Номер телефона для связи с оператором {phone_operator}"
        return message
