from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette import status
from src.api.services.services import generate_access_code, hash_code
from src.api.services.services_operator import get_application_for_update
from src.models import AccessCode, Stage, STATUS_DIAGNOSED


#создание и проверка кода+сохранение
def create_unique_access_code(db: Session, role: str, FIO: str) -> tuple[AccessCode, str]:

    fio_test = db.query(AccessCode).filter(AccessCode.FIO == FIO).first()
    if not fio_test:
        while True:
            new_code = generate_access_code()
            hashed = hash_code(new_code)

            # Проверка на дубликат
            existing = db.query(AccessCode).filter(AccessCode.code_hash == hashed).first()
            if not existing:
                break


        db_access_code = AccessCode(
            code_hash=hashed,
            role=role,
            FIO=FIO,
            is_active=True
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f'Работник с таким ФИО уже есть в базе данных'
        )
#мы сохраняем в бд хэш, не сам код, но код отдаем в return,
# чтобы вывести его в эндпоинте ниже, чтобы пользователь мох сохранить его и передать работнику
    db.add(db_access_code)
    #параллельный запрос мог успеть сохранить работника с таким же ФИО между проверкой и сохранением
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f'Работник с таким ФИО уже есть в базе данных'
        )
    db.refresh(db_access_code)

    return db_access_code,new_code




#увольнение работника
def dismissal_employee(employee_id: int,db: Session):
    employee=db.query(AccessCode).filter(AccessCode.id==employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Работник с id={employee_id} не найден"
        )
    if not employee.is_active:
        raise HTTPException(
            status_code=400,
            detail="Работник уже уволен"
        )
    employee.is_active=False
    employee_status=f'Работник {employee_id} уволен {employee.FIO}'
    db.commit()
    db.refresh(employee)
    return {
        'status':'success',
        'message': employee_status
    }

def hire_employee(employee_id: int, db: Session):
    employee=db.query(AccessCode).filter(AccessCode.id==employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Работник с {employee_id} не найден.'
        )
    if employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Работник с {employee_id} уже работает. {employee.FIO} имеет статус is_active=True.'
        )
    employee.is_active=True
    employee_status=f'{employee.FIO} успешно возвращен на работу'
    db.commit()
    db.refresh(employee)
    return {
        'status':'success',
        'message': employee_status
    }


#админ снимает бронь с заявки, если сотрудник не может ее выполнить (заболел, уволился):
#на диагностике и проверке снимается инженер, на ремонте мастер. после этого заявку может взять другой сотрудник
def release_application(application_id: int, db: Session):
    application = get_application_for_update(application_id, db)
    if application.status_info == Stage.CREATED and application.assignee_engineer_id is not None:
        application.assignee_engineer_id = None
        application.status = application.waiting_diagnostics_status()
    elif application.status_info == Stage.DIAGNOSED and application.assignee_repairer_id is not None:
        application.assignee_repairer_id = None
        application.status = STATUS_DIAGNOSED
    elif application.status_info == Stage.REPAIRED and application.assignee_engineer_id is not None:
        application.assignee_engineer_id = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка с id={application_id} сейчас никем не забронирована"
        )

    db.commit()
    db.refresh(application)
    return application