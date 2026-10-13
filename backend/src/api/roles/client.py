from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import TypeAdapter, ValidationError
from src.databases.database import get_db
from src.api.services.services_client import status_client
from src.auth.auth import get_current_client

router_client=APIRouter(prefix='/client',tags=['Клиент<3'],dependencies=[Depends(get_current_client)])
#гетаем статус заявки
@router_client.get('/status')
def status_client_id(application_id=Query(..., json_schema_extra={"type": "integer"}),db=Depends(get_db),client=Depends(get_current_client)):
    try:
        application_id = TypeAdapter(int).validate_python(application_id)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Некорректный ID заявки")
    return status_client(application_id=application_id,db=db,client_id=client.id)
