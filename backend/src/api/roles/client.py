from fastapi import APIRouter, Depends, Query
from src.databases.database import get_db
from src.api.services.services_client import status_client, create_client_application, get_client_own_applications
from src.shemas import ClientApplicationCreateShema, ClientApplicationShema
from src.auth.auth import get_current_client

router_client=APIRouter(prefix='/client',tags=['Клиент<3'],dependencies=[Depends(get_current_client)])
#гетаем статус заявки
@router_client.get('/status')
def status_client_id(
    application_code: str | None = Query(default=None, json_schema_extra={"type": "string", "pattern": "^[A-Za-z0-9]{8}$"}),
    db=Depends(get_db),client=Depends(get_current_client)):
    return status_client(db=db, client_id=client.id, application_code=application_code)


#Клиент сам создает заявку, в ответе код для проверки статуса
@router_client.post('/applications', response_model=ClientApplicationShema, status_code=201, summary='Создать заявку')
def create_client_application_endpoint(data: ClientApplicationCreateShema, db=Depends(get_db), client=Depends(get_current_client)):
    return create_client_application(client=client, data=data, db=db)


#Все заявки клиента: что за устройство, описание, когда создана и код для проверки статуса
@router_client.get('/applications', response_model=list[ClientApplicationShema], summary='Мои заявки')
def get_client_applications_endpoint(db=Depends(get_db), client=Depends(get_current_client)):
    return get_client_own_applications(client=client, db=db)
