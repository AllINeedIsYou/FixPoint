from enum import IntEnum
from sqlalchemy import String, Text, Integer, Numeric, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.databases.database import Base

#фиксированная стоимость работы мастера, добавляется к стоимости запчастей
WORK_COST = 5000


#этапы заявки (поле status_info), в БД хранится число
class Stage(IntEnum):
    CREATED = 0     #заявка создана, ждет диагностики
    DIAGNOSED = 1   #диагностика завершена, ждет ремонта
    REPAIRED = 2    #ремонт завершен, ждет проверки инженером
    CHECKED = 3     #проверка пройдена, ждет выдачи клиенту
    ISSUED = 4      #устройство выдано клиенту, заявка закрыта
    #проверка не пройдена -> заявка возвращается в CREATED на повторную диагностику


#тексты статусов (поле status), их видит клиент
STATUS_CREATED = 'Заявка создана. Ожидание диагностики'
STATUS_DIAGNOSTICS_TAKEN = 'Заявка взята в диагностику. Ожидается выполнение...'
STATUS_DIAGNOSED = 'Диагностика завершена. Ожидание выполнения работы...'
STATUS_REPAIR_TAKEN = 'Заявка взята в работу. Ожидается выполнение...'
STATUS_REPAIRED = 'Работы завершены. Ожидание проверки'
STATUS_CHECKED = 'Проверка пройдена. Устройство готово к выдаче'
STATUS_CHECK_FAILED = 'Проверка не пройдена. Ожидание повторной диагностики'
STATUS_ISSUED = 'Устройство выдано клиенту. Заявка закрыта'


#клиенты: телефон определяет клиента, по нему видна история всех его заявок
class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    FIO: Mapped[str] = mapped_column(String(255), nullable=False)

    number: Mapped[str] = mapped_column(String(50),nullable=False,unique=True)

    email: Mapped[str] = mapped_column(String(255),nullable=False)

    applications: Mapped[list["Application"]] = relationship(back_populates="client", order_by="Application.id")

    @property
    def application_ids(self) -> list[int]:
        return [application.id for application in self.applications]


#таблица с заявками
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"),nullable=False)

    client: Mapped["Client"] = relationship(back_populates="applications")

    info: Mapped[str] = mapped_column(Text,nullable=False)

    status_info: Mapped[int]=mapped_column(Integer,default=Stage.CREATED)

    status:Mapped[str]=mapped_column(String(400),default=STATUS_CREATED)

    diagnostic_result:Mapped[str|None]=mapped_column(default=None)

    #комментарий инженера по последней проверке ремонта
    check_result: Mapped[str | None] = mapped_column(Text, default=None)

    #мастер, взявший заявку в работу
    assignee_repairer_id: Mapped[int | None] = mapped_column(ForeignKey("access_codes.id"),nullable=True,default=None)

    assignee_engineer_id: Mapped[int | None] = mapped_column(ForeignKey("access_codes.id"), nullable=True, default=None)

    parts: Mapped[list["Part"]] = relationship(back_populates="application", cascade="all, delete-orphan")

    #текст статуса заявки, которая ждет диагностики: новая или вернувшаяся с проваленной проверки
    #(на этапе CREATED check_result заполнен только если последняя проверка не пройдена)
    def waiting_diagnostics_status(self) -> str:
        return STATUS_CHECK_FAILED if self.check_result else STATUS_CREATED

    #данные клиента в ответах API остаются полями заявки, как было до таблицы клиентов
    @property
    def FIO(self) -> str:
        return self.client.FIO

    @property
    def number(self) -> str:
        return self.client.number

    @property
    def email(self) -> str:
        return self.client.email

    #стоимость запчастей по заявке
    @property
    def parts_cost(self) -> float:
        return sum(part.price * part.quantity for part in self.parts)

    @property
    def work_cost(self) -> int:
        return WORK_COST

    #итоговая стоимость: запчасти + работа
    @property
    def total_cost(self) -> float:
        return self.parts_cost + self.work_cost


#общий склад запчастей, цены и остатки ведет админ
class StockPart(Base):
    __tablename__ = "stock_parts"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    name: Mapped[str] = mapped_column(String(255),nullable=False,unique=True)

    price: Mapped[float] = mapped_column(Numeric(10,2),nullable=False)

    quantity: Mapped[int] = mapped_column(Integer,default=0,nullable=False)


#название на складе уникально без учета регистра: "Шлейф" и "шлейф" - одна запчасть
Index("ix_stock_parts_name_lower", func.lower(StockPart.name), unique=True)


#запчасти, списанные со склада на заявку
class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"),nullable=False)

    stock_part_id: Mapped[int | None] = mapped_column(ForeignKey("stock_parts.id"),nullable=True)

    #название и цена копируются со склада в момент списания,
    #чтобы смена цены на складе не меняла стоимость уже идущих ремонтов
    name: Mapped[str] = mapped_column(String(255),nullable=False)

    price: Mapped[float] = mapped_column(Numeric(10,2),nullable=False)

    quantity: Mapped[int] = mapped_column(Integer,default=1,nullable=False)

    application: Mapped["Application"] = relationship(back_populates="parts")


#таблица авторизация
class AccessCode(Base):
    __tablename__ = 'access_codes'
    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    FIO: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    code_hash: Mapped[str] = mapped_column(String(255),nullable=False,unique=True)

    role: Mapped[str] = mapped_column(String(50),nullable=False)

    is_active: Mapped[bool] = mapped_column(default=True,nullable=False)

