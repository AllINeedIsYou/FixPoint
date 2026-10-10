import hashlib
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.orm import Session
from src.databases.database import get_db, settings
from src.models import AccessCode
from src.shemas import TokenResponseSchema
from fastapi.security import OAuth2PasswordBearer

# Секретный ключ JWT
SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

#описание видно в окне Authorize в swagger
security = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    description="Вход по коду доступа сотрудника: введите код в поле **username**, поле **password** оставьте пустым.",
)


router_auth = APIRouter(prefix="/auth", tags=["Авторизация"])

#функция кеширования
def hash_code(code: str):
    return hashlib.sha256(code.encode("utf-8")).hexdigest()

#генерация токена jwt
def create_access_token(data: dict):
    to_encode = data.copy()

    #время истечения токена
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})

    # Кодируем данные (SECRET_KEY+ALGORITHM)
    coded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return coded_jwt

#ВХОД
@router_auth.post("/login",response_model=TokenResponseSchema,summary="Вход по уникальному коду",include_in_schema=False)
#код приходит в поле username (так устроена форма входа OAuth2 в swagger), пароль не нужен и игнорируется
def login_for_access_token(code: str = Form(alias="username"), db: Session = Depends(get_db)):
    #Хешируем код пользователя
    hashed_input = hash_code(code)
    #сравниваем два хеша
    access_code_entry = (db.query(AccessCode).filter(AccessCode.code_hash == hashed_input).first())
    #Если пальчиком по буковке промазал
    if not access_code_entry:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный код доступа",
        )

    # Если код найден, но деактивирован
    if not access_code_entry.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Данный код доступа деактивирован",
        )

    token_data = {
        "sub": str(access_code_entry.id),
        "role": access_code_entry.role
    }
    jwt_token = create_access_token(data=token_data)

    return TokenResponseSchema(access_token=jwt_token,token_type="bearer",role=access_code_entry.role)




#ПРОВЕРКА ВАЛИДНОСТИ ТОКЕНА jwt
def require_role(required_role: str):
    def dependency(token: str = Depends(security), db: Session = Depends(get_db)):
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_role: str = payload.get("role")

            #токен живет 24 часа, поэтому уволенного проверяем по БД на каждом запросе, а не только при входе
            employee_id = payload.get("sub")
            employee = None
            if isinstance(employee_id, str) and employee_id.isdigit():
                employee = db.query(AccessCode).filter(AccessCode.id == int(employee_id)).first()
            if employee is None or not employee.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Сотрудник не найден или уволен, войдите заново",
                )

            if user_role is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Невалидный токен: отсутствует роль",
                )

            if user_role != required_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Недостаточно прав. Требуется роль: {required_role}",
                )

            return payload

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Срок действия токена истек",
            )
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось проверить токен",
            )

    return dependency
