from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.services.services import get_all_applications
from src.api.services.services_operator import (del_elements_aplication_by_id, issue_application,
                                               create_application, get_clients, get_client_applications)
from src.auth.auth import require_role
from src.shemas import ApplicationCreateShema, ApplicationShema, ClientShema
from src.databases.database import get_db

#номер оператора для связи клиента с оператором
phone_operator='+71234567890'



router_operator=APIRouter(prefix='/operator',tags=["Оператор"])


# @router_operator.get("/dashboard", dependencies=[Depends(require_role("operator"))], summary='Вход')
# def get_engineer_dashboard():
#     return {"message": "Добро пожаловать в панель управления Оператора! Желаем вам приятной смены<3"}

@router_operator.post("/add_application",summary="Добавление заявки", dependencies=[Depends(require_role("operator"))])
def add_application(
    application: ApplicationCreateShema,
    db: Session = Depends(get_db)
):
    new_application = create_application(data=application, db=db)
    return {
        "status": "application added",
        "id": new_application.id,
        "client_id": new_application.client_id,
    }

@router_operator.get("/get_applications",response_model=list[ApplicationShema],summary="Список заявок", dependencies=[Depends(require_role("operator"))])
def get_application_operator(db: Session = Depends(get_db)):
    return get_all_applications(db=db)

@router_operator.delete('/delete_applications/{application_id}',summary='Удаление заявки', dependencies=[Depends(require_role("operator"))])
def del_aplication(application_id:int, db:Session=Depends(get_db)):
    return del_elements_aplication_by_id(aplication_id=application_id,db=db)


#Выдача отремонтированного устройства клиенту, заявка закрывается
@router_operator.post('/{application_id}/issue', response_model=ApplicationShema, summary='Выдача устройства клиенту', dependencies=[Depends(require_role("operator"))])
def issue_application_endpoint(application_id: int, db: Session = Depends(get_db)):
    return issue_application(application_id=application_id, db=db)


#Список клиентов с id их заявок, поиск по части ФИО или телефона
@router_operator.get('/clients', response_model=list[ClientShema], summary='Список клиентов', dependencies=[Depends(require_role("operator"))])
def get_clients_endpoint(search: str | None = None, db: Session = Depends(get_db)):
    return get_clients(db=db, search=search)


#История обращений клиента: все его заявки
@router_operator.get('/clients/{client_id}/applications', response_model=list[ApplicationShema], summary='Заявки клиента', dependencies=[Depends(require_role("operator"))])
def get_client_applications_endpoint(client_id: int, db: Session = Depends(get_db)):
    return get_client_applications(client_id=client_id, db=db)
