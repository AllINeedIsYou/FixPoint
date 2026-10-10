from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field
from pydantic_extra_types.phone_numbers import PhoneNumber


# Пределы под колонки БД: цена Numeric(10,2), количество Integer (с запасом на возвраты на склад).
# Значение больше Postgres не сохранит и отдаст 500, поэтому режем на входе
MIN_PRICE = 0.01
MAX_PRICE = 99999999.99
MAX_QUANTITY = 1000000


# Postgres не принимает строки с символом \x00 и битыми символами (одиночные суррогаты), отдаем 422 вместо 500
def check_text(value: str) -> str:
    if "\x00" in value:
        raise ValueError("строка не должна содержать символ \\x00")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("строка содержит некорректные символы")
    return value


CleanStr = Annotated[str, AfterValidator(check_text)]


# Схема для заявки(отображаемая пользователю)
class ApplicationCreateShema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    FIO: CleanStr = Field(max_length=255)
    number: PhoneNumber
    email: EmailStr
    info: CleanStr = Field(max_length=1000)


# Схема для запчасти на складе(админ добавляет), пробелы по краям названия обрезаются
class StockPartCreateShema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: CleanStr = Field(min_length=1, max_length=255)
    price: float = Field(ge=MIN_PRICE, le=MAX_PRICE)
    quantity: int = Field(default=0, ge=0, le=MAX_QUANTITY)


# Схема для изменения цены/остатка на складе, можно передать только одно поле
class StockPartUpdateShema(BaseModel):
    price: float | None = Field(default=None, ge=MIN_PRICE, le=MAX_PRICE)
    quantity: int | None = Field(default=None, ge=0, le=MAX_QUANTITY)


# Схема для ответа без ограничений входа, чтобы любая запись из БД отдавалась без 500
class StockPartShema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
    quantity: int


# Схема для запчасти в заявку(мастер указывает что и сколько взять со склада)
class PartCreateShema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: CleanStr = Field(min_length=1, max_length=255)
    quantity: int = Field(default=1, gt=0, le=MAX_QUANTITY)


class PartShema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    stock_part_id: int | None
    name: str
    price: float
    quantity: int


# Схема для отметки диагностики(инженер пишет результат), пробелы по краям обрезаются
class DiagnosticsShema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    diagnostic_info: CleanStr = Field(min_length=1, max_length=1000)


class ApplicationShema(ApplicationCreateShema):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status_info: int
    status: str
    assignee_repairer_id: int | None = None
    assignee_engineer_id: int | None = None
    parts: list[PartShema] = []
    parts_cost: float = 0
    work_cost: float = 0
    total_cost: float = 0
    diagnostic_result: str | None = Field(default=None)


# Схема для запроса на создание кода
class AccessCodeCreateSchema(BaseModel):
    role: str
    FIO: CleanStr = Field(max_length=255)


# Схема для ответа клиенту
class AccessCodeResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    role: str
    is_active: bool



# схема для маленькой, миленькой jwtешки
class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

