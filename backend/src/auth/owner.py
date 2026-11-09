"""Однократное создание владельца: python -m src.auth.owner (из backend)."""
import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.services.services import generate_access_code, hash_code
from src.models import AccessCode, OwnerAccessCode


def initialize_owner(db: Session) -> tuple[AccessCode, list[str]]:
    if db.query(AccessCode).filter(AccessCode.role == "owner").first() is not None:
        raise ValueError("Владелец уже создан. Его пять кодов остаются прежними; повторная инициализация запрещена.")
    # Основное поле кода не используется для входа владельца.
    # Владелец входит исключительно по одному из пяти отдельных ключей.
    owner = AccessCode(FIO="Владелец", role="owner", code_hash=hash_code(secrets.token_urlsafe(64)), is_active=True)
    codes = []
    try:
        db.add(owner)
        db.flush()  # уникальный индекс допускает только одного владельца, в том числе при гонке
        for slot in range(1, 6):
            while True:
                code = generate_access_code(length=15)
                if code not in codes and not db.query(AccessCode).filter(AccessCode.code_hash == hash_code(code)).first():
                    break
            codes.append(code)
            db.add(OwnerAccessCode(slot=slot, owner_id=owner.id, code_hash=hash_code(code)))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Не удалось создать владельца: он уже существует или ФИО «Владелец» занято.") from None
    db.refresh(owner)
    return owner, codes


if __name__ == "__main__":
    from src.databases.database import SessionLocal
    with SessionLocal() as session:
        try:
            owner, codes = initialize_owner(session)
        except ValueError as error:
            raise SystemExit(str(error))
        print(f"Создан единственный владелец (id={owner.id}). Пять бессрочных кодов, каждый по 15 символов:")
        for index, code in enumerate(codes, 1):
            print(f"{index}. {code}")
        print("Сохраните коды: в базе хранятся только хеши, повторный вывод невозможен.")
