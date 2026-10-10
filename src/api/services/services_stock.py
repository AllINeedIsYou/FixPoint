from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette import status

from src.models import StockPart
from src.shemas import StockPartCreateShema, StockPartUpdateShema


#список запчастей на складе, с поиском по части названия
def get_stock(db: Session, search: str | None = None):
    query = db.query(StockPart)
    if search:
        query = query.filter(func.lower(StockPart.name).contains(search.strip().lower(), autoescape=True))
    return query.order_by(StockPart.name).all()


#добавление новой запчасти на склад
def create_stock_part(data: StockPartCreateShema, db: Session):
    name = data.name.strip()
    existing = db.query(StockPart).filter(func.lower(StockPart.name) == name.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Запчасть '{existing.name}' уже есть на складе (id={existing.id}), измените ее цену или количество"
        )

    stock_part = StockPart(name=name, price=data.price, quantity=data.quantity)
    db.add(stock_part)
    db.commit()
    db.refresh(stock_part)
    return stock_part


#изменение цены и/или остатка на складе
def update_stock_part(stock_part_id: int, data: StockPartUpdateShema, db: Session):
    stock_part = db.query(StockPart).filter(StockPart.id == stock_part_id).first()
    if not stock_part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запчасть с id={stock_part_id} на складе не найдена"
        )
    if data.price is None and data.quantity is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите новую цену и/или количество"
        )

    if data.price is not None:
        stock_part.price = data.price
    if data.quantity is not None:
        stock_part.quantity = data.quantity
    db.commit()
    db.refresh(stock_part)
    return stock_part
