from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.services.services_admin import create_unique_access_code, dismissal_employee,hire_employee,release_application,reload_access_codes
from src.databases.database import get_db, Base
from src.shemas import ApplicationShema, AccessCodeCreateSchema, AccessCodeResponseSchema, ReloadAccessCodeResponcrShema,ReloadAccessCodeCreateShema
from src.api.services.services import get_all_applications, get_all_accesscode, get_all_parts
from src.api.services.services_stock import get_stock, create_stock_part, update_stock_part
from src.shemas import StockPartShema, StockPartCreateShema, StockPartUpdateShema, CleanStr
from src.shemas import EmployeeResponseSchema
from src.auth.auth import require_role


admin_access = require_role("admin")
router_admin = APIRouter(prefix='/services', tags=["Админ и владелец"], dependencies=[Depends(admin_access)])


#СПИСОК ЗАЯВОК
@router_admin.get("/get_applications", response_model=list[ApplicationShema], summary="Список заявок")
def get_application_endpoint(db: Session = Depends(get_db)):
    return get_all_applications(db)

#CПИСОК КОДОВ
@router_admin.get('/get_accesscode', response_model=list[EmployeeResponseSchema], summary="Список работников без кодов и хешей")
def get_all_accesscode_endpoint(db: Session=Depends(get_db), actor: dict = Depends(admin_access)):
    return get_all_accesscode(db, actor_role=actor["role"])


# СОЗДАНИЕ ФАЙЛА С БД
@router_admin.post('/database_create', summary='Создать отсутствующие таблицы без удаления данных')
def create_bd(db: Session = Depends(get_db)):
    Base.metadata.create_all(bind=db.get_bind())
    return {"status": "database ready"}


#СГЕНЕРИРОВАТЬ И СОХРАНИТЬ НОВЫЙ КОД ДОСТУПА
@router_admin.post("/access-codes",response_model=AccessCodeResponseSchema,summary="Сгенерировать и сохранить новый код доступа")
def generate_code_endpoint(data: AccessCodeCreateSchema,db: Session = Depends(get_db), actor: dict = Depends(admin_access)):
    db_entry, raw_code = create_unique_access_code(db=db, role=data.role, FIO=data.FIO, actor_role=actor["role"])

    return AccessCodeResponseSchema(
        id=db_entry.id,
        code=raw_code,
        role=db_entry.role,
        is_active=db_entry.is_active #AccessCodeResponseSchema
    )

@router_admin.post('/reload-access-code',response_model=ReloadAccessCodeResponcrShema, summary='перевыпустить код достпуа')
def reload_ac(data: ReloadAccessCodeCreateShema, db: Session = Depends(get_db), actor: dict = Depends(admin_access)):
    return reload_access_codes(db=db,data=data, actor_role=actor["role"])



#УВОЛЬНЕНИЕ
@router_admin.patch('/{employee_id}/dismissal',summary='Увольнение работника, деактивация')
def dismissal(employee_id:int ,db:Session=Depends(get_db), actor: dict = Depends(admin_access)):
    return dismissal_employee(employee_id=employee_id,db=db, actor_role=actor["role"])

#Возвращение на работу
@router_admin.patch('/{employee_id}/hier',summary='Возвращение работника на работу')
def hire_worker(employee_id:int ,db:Session=Depends(get_db), actor: dict = Depends(admin_access)):
    return hire_employee(employee_id=employee_id,db=db, actor_role=actor["role"])
#СКЛАД: СПИСОК ЗАПЧАСТЕЙ
@router_admin.get('/stocks', summary="Склад запчастей")
def get_stocks(db: Session = Depends(get_db)):
    return get_all_parts(db=db)

#Поиск по складу запчастей
@router_admin.get('/stock', response_model=list[StockPartShema], summary='Поиск по складу запчастей')
def get_stock_admin(search: CleanStr | None = None, db: Session = Depends(get_db)):
    return get_stock(db=db, search=search)

#СКЛАД: ДОБАВИТЬ НОВУЮ ЗАПЧАСТЬ
@router_admin.post('/stock', response_model=StockPartShema, summary='Добавить запчасть на склад')
def create_stock_part_endpoint(data: StockPartCreateShema, db: Session = Depends(get_db)):
    return create_stock_part(data=data, db=db)

#СКЛАД: ИЗМЕНИТЬ ЦЕНУ/КОЛИЧЕСТВО
@router_admin.patch('/stock/{stock_part_id}', response_model=StockPartShema, summary='Изменить цену или количество на складе')
def update_stock_part_endpoint(stock_part_id: int, data: StockPartUpdateShema, db: Session = Depends(get_db)):
    return update_stock_part(stock_part_id=stock_part_id, data=data, db=db)

#Снять бронь с заявки, если сотрудник не может ее выполнить: снимается инженер (на диагностике) или мастер (на ремонте)
@router_admin.post('/{application_id}/release', response_model=ApplicationShema, summary='Снять исполнителя с заявки')
def release_application_endpoint(application_id: int, db: Session = Depends(get_db)):
    return release_application(application_id=application_id, db=db)
