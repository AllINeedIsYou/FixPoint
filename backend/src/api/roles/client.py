from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import TypeAdapter, ValidationError
from src.databases.database import get_db
from src.api.services.services_client import status_client
from src.auth.auth import get_current_client
from src.models import Application

router_client=APIRouter(prefix='/client',tags=['Клиент<3'],dependencies=[Depends(get_current_client)])
#гетаем статус заявки
@router_client.get('/status')
def status_client_id(
    application_code=Query(default=None, json_schema_extra={"type": "string", "pattern": "^[A-Za-z0-9]{8}$"}),
    db=Depends(get_db),client=Depends(get_current_client)):
    return status_client(db=db,application_code=application_code)
