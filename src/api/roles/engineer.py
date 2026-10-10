from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.services.services import get_all_applications
from src.api.services.services_engineer import perform_diagnostics, take_engineer_application, release_engineer_application
from src.auth.auth import require_role
from src.databases.database import get_db
from src.shemas import ApplicationShema, DiagnosticsShema


router_eng = APIRouter(prefix="/engineer", tags=["Инженер"])


# @router_eng.get("/dashboard", dependencies=[Depends(require_role("engineer"))], summary='Вход')
# def get_engineer_dashboard():
#     return {"message": "Добро пожаловать в панель управления инженера! Желаем вам приятной смены<3"}


# получаем список заявок
@router_eng.get("/get_applications", response_model=list[ApplicationShema], summary="Список заявок", dependencies=[Depends(require_role("engineer"))])
def get_application_engineer(db: Session = Depends(get_db)):
    return get_all_applications(db=db)


# отмечаем диагностику, результат диагностики приходит в теле запроса
@router_eng.post('/{application_id}/diagnose', response_model=ApplicationShema, summary='Отметка о готовности диагностики', dependencies=[Depends(require_role("engineer"))])
def diagnostics_complete(application_id: int, data: DiagnosticsShema, payload: dict = Depends(require_role("engineer")), db: Session = Depends(get_db)):
    return perform_diagnostics(aplication_id=application_id,employee_id=int(payload["sub"]),diagnostic_info=data.diagnostic_info,db=db)


#Взять заявку в работу
@router_eng.post('/{application_id}/takeEngineer',dependencies=[Depends(require_role("engineer"))],response_model=ApplicationShema, summary='Взять заявку в работу')
def take_application_endpoint(application_id: int, payload: dict = Depends(require_role("engineer")), db: Session = Depends(get_db)):
    employee_id = int(payload["sub"])
    return take_engineer_application(application_id=application_id, employee_id=employee_id, db=db)


#Отказаться от забронированной заявки до завершения диагностики
@router_eng.post('/{application_id}/release', response_model=ApplicationShema, summary='Снять бронь с заявки')
def release_application_endpoint(application_id: int, payload: dict = Depends(require_role("engineer")), db: Session = Depends(get_db)):
    return release_engineer_application(application_id=application_id, employee_id=int(payload["sub"]), db=db)
