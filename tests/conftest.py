import os

# по умолчанию тесты идут на SQLite в памяти и не трогают настоящую БД из .env.
# TEST_DATABASE_URL - прогнать тесты на Postgres: только отдельная пустая БД, все таблицы в ней удаляются
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL or "sqlite://"
os.environ.setdefault("SECRET_KEY", "test-secret-key-only-for-pytest-runs")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from src.databases.database import Base, get_db


@pytest.fixture
def db_session_factory():
    if TEST_DATABASE_URL:
        engine = create_engine(TEST_DATABASE_URL)
        Base.metadata.drop_all(bind=engine)
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

        # встроенный lower() в SQLite не понимает кириллицу, в Postgres понимает
        @event.listens_for(engine, "connect")
        def _unicode_lower(dbapi_conn, _):
            dbapi_conn.create_function("lower", 1, lambda s: s.lower() if s is not None else None, deterministic=True)

    Base.metadata.create_all(bind=engine)
    yield sessionmaker(bind=engine, autoflush=False, autocommit=False)
    if TEST_DATABASE_URL:
        Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(db_session_factory):
    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def employee(client):
    def make(role, fio):
        r = client.post("/services/access-codes", json={"role": role, "FIO": fio})
        assert r.status_code == 200, r.text
        data = r.json()
        r = client.post("/auth/login", data={"username": data["code"]})
        assert r.status_code == 200, r.text
        return data["id"], _auth(r.json()["access_token"])
    return make


@pytest.fixture
def staff(employee):
    operator_id, operator = employee("operator", "Оператор")
    engineer_id, engineer = employee("engineer", "Инженер 1")
    other_engineer_id, other_engineer = employee("engineer", "Инженер 2")
    repairer_id, repairer = employee("repairer", "Мастер 1")
    other_id, other = employee("repairer", "Мастер 2")
    return {
        "operator": operator,
        "engineer": engineer,
        "engineer_id": engineer_id,
        "other_engineer": other_engineer,
        "repairer": repairer,
        "repairer_id": repairer_id,
        "other_repairer": other,
    }


@pytest.fixture
def new_application(client, staff):
    def make():
        r = client.post(
            "/operator/add_application",
            json={"FIO": "Иван", "number": "+79161234567", "email": "ivan@example.com", "info": "не включается"},
            headers=staff["operator"],
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]
    return make


def diagnose(client, headers, app_id, info="сгорел блок питания"):
    return client.post(f"/engineer/{app_id}/diagnose", json={"diagnostic_info": info}, headers=headers)


def take_and_diagnose(client, headers, app_id):
    """инженер бронирует заявку и отмечает диагностику"""
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=headers).status_code == 200
    r = diagnose(client, headers, app_id)
    assert r.status_code == 200, r.text
    return r


@pytest.fixture
def application_in_repair(client, staff, new_application):
    """заявка после диагностики, взятая первым мастером"""
    app_id = new_application()
    take_and_diagnose(client, staff["engineer"], app_id)
    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"]).status_code == 200
    return app_id


@pytest.fixture
def stock(client):
    def add(name, price, quantity):
        r = client.post("/services/stock", json={"name": name, "price": price, "quantity": quantity})
        assert r.status_code == 200, r.text
        return r.json()
    return add


def get_application(client, headers, app_id):
    r = client.get("/repairer/get_applications", headers=headers)
    assert r.status_code == 200, r.text
    return next(a for a in r.json() if a["id"] == app_id)


def stock_quantity(client, name):
    r = client.get("/services/stock", params={"search": name})
    return next(p for p in r.json() if p["name"] == name)["quantity"]
