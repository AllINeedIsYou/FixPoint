from sqlalchemy import String, Text, Integer, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.databases.database import Base

#таблица с заявками
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    FIO: Mapped[str] = mapped_column(String(255), nullable=False)

    number: Mapped[str] = mapped_column(String(50),nullable=False)

    email: Mapped[str] = mapped_column(String(255),nullable=False)

    info: Mapped[str] = mapped_column(Text,nullable=False)

    status_info: Mapped[int]=mapped_column(Integer,default=0)

    status:Mapped[str]=mapped_column(String(400),default='Заявка создана,Ожидание диагностки')

    diagnostic_result:Mapped[str|None]=mapped_column(default=None)

    #мастер, взявший заявку в работу
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("access_codes.id"),nullable=True,default=None)

    parts: Mapped[list["Part"]] = relationship(back_populates="application", cascade="all, delete-orphan")

    #стоимость заявки - сумма стоимости всех запчастей
    @property
    def total_cost(self) -> float:
        return sum(part.price * part.quantity for part in self.parts)


#таблица с запчастями, использованными в ремонте
class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True,autoincrement=True)

    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"),nullable=False)

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

