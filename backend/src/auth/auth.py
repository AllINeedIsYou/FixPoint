import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlite3 import SQLITE_CONSTRAINT_UNIQUE

import jwt
from fastapi import APIRouter, Body, Cookie, Depends, Form, HTTPException, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.databases.database import get_db, settings
from src.models import AccessCode,Client,ClientSessions
from src.shemas import TokenResponseSchema,ClientCreateShema,ClientLoginSchema,ClientResponseShema
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

#функция хеширования
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

CLIENT_SESSION_COOKIE = "client_session"


def validate_client_data(schema, data):
    try:
        return schema.model_validate(data)
    except ValidationError as error:
        errors = error.errors(include_input=False, include_url=False)
        for item in errors:
            item["loc"] = ("body", *item["loc"])
        raise RequestValidationError(errors) from error


def register_client(db, client_data):
    now=datetime.now(timezone.utc)

    dump_client=client_data.model_dump(exclude={"password"})
    dump_client["created_at"]=now

    new_client=Client(**dump_client,password_hash=hash_code(client_data.password))

    try:
        db.add(new_client)
        db.commit()

    except IntegrityError as error:
        db.rollback()

        if isinstance(error.orig, UniqueViolation) or getattr(error.orig, "sqlite_errorcode", None) == SQLITE_CONSTRAINT_UNIQUE:
            raise HTTPException(
                status_code=409,
                detail="Логин или номер телефона уже заняты"
            )

        raise

    db.refresh(new_client)
    return new_client


def authenticate_client(db, client_data):
    client = db.query(Client).filter(Client.login == client_data.username).first()
    if client is None or client.password_hash is None:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not secrets.compare_digest(hash_code(client_data.password), client.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return client


def create_client_session(db, client_id):
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)
    entry = ClientSessions(
        client_id=client_id,
        token_hash=hash_code(token),
        created_at=now,
        expires_at=expires_at,
    )
    try:
        db.add(entry)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return token, expires_at


def get_current_client(token=Cookie(default=None, alias=CLIENT_SESSION_COOKIE, include_in_schema=False), db=Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт клиента")
    entry = db.query(ClientSessions).filter(
        ClientSessions.token_hash == hash_code(token),
        ClientSessions.expires_at > datetime.now(timezone.utc),
    ).first()
    if entry is None:
        raise HTTPException(status_code=401, detail="Сессия недействительна или истекла")
    client = db.query(Client).filter(Client.id == entry.client_id).first()
    if client is None:
        raise HTTPException(status_code=401, detail="Клиент не найден")
    return client


@router_auth.post("/client/register", response_model=ClientResponseShema, status_code=201, summary="Регистрация клиента")
def register_client_endpoint(
    client_data=Body(..., json_schema_extra=ClientCreateShema.model_json_schema()),
    db=Depends(get_db),
):
    data = validate_client_data(ClientCreateShema, client_data)
    return register_client(db=db, client_data=data)


@router_auth.post("/client/login", response_model=ClientResponseShema, summary="Вход клиента")
def login_client_endpoint(
    client_data=Body(..., json_schema_extra=ClientLoginSchema.model_json_schema()),
    db=Depends(get_db),
):
    data = validate_client_data(ClientLoginSchema, client_data)
    client = authenticate_client(db=db, client_data=data)
    token, expires_at = create_client_session(db=db, client_id=client.id)
    response = JSONResponse(content=ClientResponseShema.model_validate(client).model_dump(mode="json"))
    response.set_cookie(
        key=CLIENT_SESSION_COOKIE,
        value=token,
        expires=expires_at,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return response


@router_auth.get("/client/me", response_model=ClientResponseShema, summary="Текущий клиент")
def current_client_endpoint(client=Depends(get_current_client)):
    return client


@router_auth.post("/client/logout", status_code=204, summary="Выход клиента")
def logout_client_endpoint(token=Cookie(default=None, alias=CLIENT_SESSION_COOKIE, include_in_schema=False), db=Depends(get_db)):
    if token:
        entry = db.query(ClientSessions).filter(ClientSessions.token_hash == hash_code(token)).first()
        if entry is not None:
            db.delete(entry)
            db.commit()
    response = Response(status_code=204)
    response.delete_cookie(key=CLIENT_SESSION_COOKIE, path="/")
    return response
