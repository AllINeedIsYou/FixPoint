from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from starlette import status
from src.api.services.services_admin import create_unique_access_code, dismissal_employee,hire_employee
from src.databases.database import get_db, Base, engine
from src.shemas import ApplicationShema, AccessCodeCreateSchema, AccessCodeResponseSchema
from src.api.services.services import get_all_applications, get_all_accesscode


router_admin = APIRouter(prefix='/services', tags=["Админ"])


#СПИСОК ЗАЯВОК
@router_admin.get("/get_applications", response_model=list[ApplicationShema], summary="Список заявок")
def get_application_endpoint(db: Session = Depends(get_db)):
    return get_all_applications(db)

#CПИСОК КОДОВ
@router_admin.get('/get_accesscode',summary="Список работников и кодов")
def get_all_accesscode_endpoint(db: Session=Depends(get_db)):
    return get_all_accesscode(db)


# СОЗДАНИЕ ФАЙЛА С БД
@router_admin.post('/database_create', summary='Создание базы данных')
def create_bd():
    Base.metadata.create_all(bind=engine)
    return {"status": "database created"}


#СГЕНЕРИРОВАТЬ И СОХРАНИТЬ НОВЫЙ КОД ДОСТУПА
@router_admin.post("/access-codes",response_model=AccessCodeResponseSchema,summary="Сгенерировать и сохранить новый код доступа")
def generate_code_endpoint(data: AccessCodeCreateSchema,db: Session = Depends(get_db)):
    allowed_roles = ["operator", "engineer", "repairer"]
    if data.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимая роль. Допустимые роли: {','.join(allowed_roles)}"
        )

    db_entry, raw_code = create_unique_access_code(db=db, role=data.role, FIO=data.FIO)

    return AccessCodeResponseSchema(
        id=db_entry.id,
        code=raw_code,
        role=db_entry.role,
        is_active=db_entry.is_active #AccessCodeResponseSchema
    )

#УВОЛЬНЕНИЕ
@router_admin.patch('/{employee_id}/dismissal',summary='Увольнение работника, деактивация')
def dismissal(employee_id:int ,db:Session=Depends(get_db)):
    return dismissal_employee(employee_id=employee_id,db=db)

#Возвращение на работу
@router_admin.patch('/{employee_id}/hier',summary='Возвращение работника на работу')
def hire_worker(employee_id:int ,db:Session=Depends(get_db)):
    return hire_employee(employee_id=employee_id,db=db)