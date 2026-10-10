from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic_extra_types.phone_numbers import PhoneNumber


# Схема для заявки(отображаемая пользователю)
class ApplicationCreateShema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    FIO: str
    number: PhoneNumber
    email: EmailStr
    info: str = Field(max_length=1000)


# Схема для запчасти на складе(админ добавляет)
class StockPartCreateShema(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: float = Field(gt=0)
    quantity: int = Field(default=0, ge=0)


# Схема для изменения цены/остатка на складе, можно передать только одно поле
class StockPartUpdateShema(BaseModel):
    price: float | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, ge=0)


class StockPartShema(StockPartCreateShema):
    model_config = ConfigDict(from_attributes=True)

    id: int


# Схема для запчасти в заявку(мастер указывает что и сколько взять со склада)
class PartCreateShema(BaseModel):
    name: str = Field(min_length=1)
    quantity: int = Field(default=1, gt=0)


class PartShema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    stock_part_id: int | None
    name: str
    price: float
    quantity: int


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
    FIO: str


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

