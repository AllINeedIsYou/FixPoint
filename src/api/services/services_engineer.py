from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette import status
from src.models import Application

#функция для диагностки(status_info)
def perform_diagnostics(aplication_id:int, diagnostic_info: str, db:Session):
    application=db.query(Application).filter(Application.id==aplication_id).first()
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
    application.status_info+=1
    application.diagnostic_result=diagnostic_info
    application.status='Диагностика завершена, Ожидание выполнения работы...'
    db.commit()
    db.refresh(application)
    return application
