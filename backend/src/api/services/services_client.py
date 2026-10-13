from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from src.models import Application
from src.api.roles.operator import phone_operator

# Клиент видит только свои заявки: по коду или по прежнему ID.
def status_client(db: Session, client_id: int, application_id: int | None = None, application_code: str | None = None):
    if (application_id is None) == (application_code is None):
        raise HTTPException(status_code=422, detail="Укажите ID или код заявки")

    query = db.query(Application).filter(Application.client_id == client_id)
    if application_code is not None:
        query = query.filter(Application.code == application_code.upper())
    else:
        query = query.filter(Application.id == application_id)
    application = query.first()


    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )

    message = f"Здравствуйте, {application.FIO}! Ваша заявка находится в статусе: {application.status}  Номер телефона для связи с оператором {phone_operator}"

    return message
