from sqlalchemy.orm import Session
import secrets
import hashlib
import string
from src.models import Application,AccessCode,StockPart

#ФУНКЦИЯ ХЕШИРОВАНИЯ
def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode('utf-8')).hexdigest()

# ЧИСТАЯ ФУНКЦИЯ ДЛЯ БД ЗАЯВКА
def get_all_applications(db: Session):
    return db.query(Application).all()

#Чистая функция для бд запчастей
def get_all_parts(db:Session):
    return db.query(StockPart).all()

#ЧИСТАЯ ФУНКЦИЯ ДЛЯ БД КОДЫ
def get_all_accesscode(db: Session):
    return db.query(AccessCode).all()


# ГЕНЕРИРУЕМ КОД
def generate_access_code(length: int = 12):
    alphabet = string.ascii_uppercase + string.digits

    return ''.join(
        secrets.choice(alphabet)
        for _ in range(length)
    )

# ГЕНЕРАЦИЯ КОДА ЗАЯВКИ
def generate_application_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for i in range(8))

#новая заявка клиента с уникальным кодом, одинаково для оператора и для самого клиента
def build_application(client, data) -> Application:
    return Application(
        client=client, info=data.info, device=data.device, device_model=data.device_model,
        address=data.address, code=generate_application_code(),
    )
