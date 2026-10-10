from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.services.services import get_all_applications
from src.api.services.services_stock import get_stock
from src.shemas import StockPartShema, CleanStr
from src.auth.auth import require_role
from src.databases.database import get_db
from src.shemas import ApplicationShema, PartCreateShema
from src.api.services.services_repairer import repair_info, add_part, delete_part, take_repairer_application, release_repairer_application

router_repair=APIRouter(prefix='/repairer',tags=["Мастер по ремонту"])

# @router_repair.get("/dashboard", dependencies=[Depends(require_role("repairer"))], summary='Вход')
# def get_engineer_dashboard():
#     return {"message": "Добро пожаловать в панель управления Мастера по ремонту! Желаем вам приятной смены<3"}

#Получаем список заявок
@router_repair.get("/get_applications",response_model=list[ApplicationShema],dependencies=[Depends(require_role("repairer"))],summary="Список заявок")
def get_application_repairer(db: Session = Depends(get_db)):
    return get_all_applications(db=db)


#Просмотр склада, чтобы знать какие запчасти можно взять
@router_repair.get("/stock", response_model=list[StockPartShema], dependencies=[Depends(require_role("repairer"))], summary="Склад запчастей")
def get_stock_repairer(search: CleanStr | None = None, db: Session = Depends(get_db)):
    return get_stock(db=db, search=search)


#Отметка о готовности ремонта
@router_repair.post('/{application_id}/repair', response_model=ApplicationShema, summary='Отметка о готовности ремонта', dependencies=[Depends(require_role("repairer"))])
def status_repair(application_id: int, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    return repair_info(application_id=application_id, employee_id=int(payload["sub"]), db=db)


#Списание запчасти со склада на заявку, цена берется со склада, стоимость пересчитывается автоматически
@router_repair.post('/{application_id}/parts', response_model=ApplicationShema, summary='Добавление запчасти со склада')
def add_part_to_application(application_id: int, part: PartCreateShema, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    return add_part(application_id=application_id, employee_id=int(payload["sub"]), part_data=part, db=db)


#Удаление ошибочно добавленной запчасти, количество возвращается на склад
@router_repair.delete('/{application_id}/parts/{part_id}', response_model=ApplicationShema, summary='Удаление запчасти')
def delete_part_from_application(application_id: int, part_id: int, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    return delete_part(application_id=application_id, part_id=part_id, employee_id=int(payload["sub"]), db=db)


#Взять заявку в работу
@router_repair.post('/{application_id}/takeRepair',dependencies=[Depends(require_role("repairer"))],response_model=ApplicationShema, summary='Взять заявку в работу')
def take_application_endpoint(application_id: int, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    employee_id = int(payload["sub"])
    return take_repairer_application(application_id=application_id, employee_id=employee_id, db=db)


#Отказаться от взятой заявки до завершения ремонта, списанные запчасти остаются в заявке
@router_repair.post('/{application_id}/release', response_model=ApplicationShema, summary='Отказаться от заявки')
def release_application_endpoint(application_id: int, payload: dict = Depends(require_role("repairer")), db: Session = Depends(get_db)):
    return release_repairer_application(application_id=application_id, employee_id=int(payload["sub"]), db=db)
