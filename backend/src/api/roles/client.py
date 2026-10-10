from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.databases.database import get_db
from src.api.services.services_client import status_client

router_client=APIRouter(prefix='/client',tags=['Клиент<3'])
#гетаем статус заявки
@router_client.get('/status')
def status_client_id(application_id:int,db: Session=Depends(get_db)):
    return status_client(application_id=application_id,db=db)