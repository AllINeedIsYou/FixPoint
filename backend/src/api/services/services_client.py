from fastapi import HTTPException, status
from src.models import Application
from src.api.roles.operator import phone_operator

#функция для просмотора статуса заявки по коду
def status_client(application_code: str, db: Session = Depends(get_db)):

    application = (
        db.query(Application)
        .filter(Application.code == application_code.upper())
        .first()
    )


    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заявка с кодом «{application_code}» не найдена",
        )

    message = f"Здравствуйте, {application.FIO}! Ваша заявка находится в статусе: {application.status}  Номер телефона для связи с оператором {phone_operator}"

    return message