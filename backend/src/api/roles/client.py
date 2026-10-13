from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import TypeAdapter, ValidationError
from src.databases.database import get_db
from src.api.services.services_client import status_client
from src.auth.auth import get_current_client

router_client=APIRouter(prefix='/client',tags=['Клиент<3'],dependencies=[Depends(get_current_client)])
#гетаем статус заявки
@router_client.get('/status')
def status_client_id(
    application_id=Query(default=None, json_schema_extra={"type": "integer"}),
    application_code=Query(default=None, json_schema_extra={"type": "string", "pattern": "^[A-Za-z0-9]{8}$"}),
    db=Depends(get_db),
    client=Depends(get_current_client),
):
    if (application_id is None) == (application_code is None):
        raise HTTPException(status_code=422, detail="Укажите ID или код заявки")
    if application_id is not None:
        try:
            application_id = TypeAdapter(int).validate_python(application_id)
        except ValidationError:
            raise HTTPException(status_code=422, detail="Некорректный ID заявки")
    if application_code is not None:
        if len(application_code) != 8 or not application_code.isascii() or not application_code.isalnum():
            raise HTTPException(status_code=422, detail="Некорректный код заявки")
    return status_client(application_id=application_id, application_code=application_code, db=db, client_id=client.id)
