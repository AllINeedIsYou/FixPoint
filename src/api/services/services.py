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
