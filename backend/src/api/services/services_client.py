from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.databases.database import get_db
from src.models import Application
from src.api.roles.operator import phone_operator

#функция для просмотора статуса заявки по айди
def status_client(application_id: int, db: Session = Depends(get_db)):

    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )


    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с id={application_id} не найдена",
        )

    message = f"Здравствуйте, {application.FIO}! Ваша заявка находится в статусе: {application.status}  Номер телефона для связи с оператором {phone_operator}"

    return message


