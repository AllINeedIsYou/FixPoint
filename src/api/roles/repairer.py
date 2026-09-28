from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.services.services import get_all_applications
from src.auth.auth import require_role
from src.databases.database import get_db
from src.shemas import ApplicationShema, PartCreateShema
from src.api.services.services_repairer import repair_info, add_part, delete_part, take_application

router_repair=APIRouter(prefix='/repairer',tags=["Мастер по ремонту"])

# @router_repair.get("/dashboard", dependencies=[Depends(require_role("repairer"))], summary='Вход')
# def get_engineer_dashboard():
#     return {"message": "Добро пожаловать в панель управления Мастера по ремонту! Желаем вам приятной смены<3"}

#Получаем список заявок
@router_repair.get("/get_applications",response_model=list[ApplicationShema],dependencies=[Depends(require_role("repairer"))],summary="Список заявок")
def get_application_repairer(db: Session = Depends(get_db)):
    return get_all_applications(db=db)


#Отметка о готовности ремонта
@router_repair.post('/{application_id}/repair', dependencies=[Depends(require_role("repairer"))], response_model=ApplicationShema, summary='Отметка о готовности ремонта')
def status_repair(application_id: int, db: Session = Depends(get_db)):
    return repair_info(application_id=application_id, db=db)


#Добавление запчасти в заявку, стоимость заявки пересчитывается автоматически
@router_repair.post('/{application_id}/parts', dependencies=[Depends(require_role("repairer"))], response_model=ApplicationShema, summary='Добавление запчасти')
def add_part_to_application(application_id: int, part: PartCreateShema, db: Session = Depends(get_db)):
    return add_part(application_id=application_id, part_data=part, db=db)


#Удаление ошибочно добавленной запчасти
@router_repair.delete('/{application_id}/parts/{part_id}', dependencies=[Depends(require_role("repairer"))], response_model=ApplicationShema, summary='Удаление запчасти')
def delete_part_from_application(application_id: int, part_id: int, db: Session = Depends(get_db)):
    return delete_part(application_id=application_id, part_id=part_id, db=db)


#Взять заявку в работу
@router_repair.post('/{application_id}/take', response_model=ApplicationShema, summary='Взять заявку в работу')
def take_application_endpoint(application_id: int, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    employee_id = int(payload["sub"])
    return take_application(application_id=application_id, employee_id=employee_id, db=db)


