from datetime import datetime, timedelta, timezone

import pytest

from .conftest import get_application

APPLICATION = {"info": "не включается", "device": "Ноутбук", "device_model": "Lenovo X1", "address": "Москва, ул. Ленина, 1",
               "courier_visit_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}


@pytest.fixture
def register(client):
    def make(login="ivan_p", number="+79161112233", email="ivan@example.com", FIO="Иван Петров"):
        r = client.post("/auth/client/register",
                        json={"FIO": FIO, "number": number, "email": email, "login": login, "password": "password123"})
        assert r.status_code == 201, r.text
        return r.json()
    return make


def login(client, username):
    r = client.post("/auth/client/login", json={"username": username, "password": "password123"})
    assert r.status_code == 200, r.text


@pytest.fixture
def logged_client(client, register):
    profile = register()
    login(client, "ivan_p")
    return profile


def test_client_creates_application(client, staff, logged_client):
    before = datetime.now(timezone.utc)
    r = client.post("/client/applications", json=APPLICATION)
    assert r.status_code == 201, r.text
    data = r.json()
    assert len(data["code"]) == 8
    assert {k: data[k] for k in ("info", "device", "device_model")} == {k: APPLICATION[k] for k in ("info", "device", "device_model")}
    created_at = datetime.fromisoformat(data["created_at"])
    # SQLite в тестах не хранит часовой пояс, Postgres хранит; время пишется в UTC
    created_at = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    assert before - timedelta(seconds=5) <= created_at <= datetime.now(timezone.utc)

    # оператор видит заявку с данными клиента из аккаунта, адресом и временем создания
    application = next(a for a in client.get("/operator/get_applications", headers=staff["operator"]).json() if a["code"] == data["code"])
    assert application["FIO"] == "Иван Петров" and application["client_id"] == logged_client["id"]
    assert application["address"] == APPLICATION["address"] and application["created_at"]
    assert application["status_info"] == -3

    # статус по коду
    assert "Иван Петров" in client.get("/client/status", params={"application_code": data["code"]}).json()


def test_client_sees_only_own_applications_newest_first(client, staff, register, logged_client):
    first = client.post("/client/applications", json=APPLICATION).json()
    second = client.post("/client/applications", json={**APPLICATION, "info": "разбит экран"}).json()

    r = client.get("/client/applications")
    assert r.status_code == 200
    assert [a["code"] for a in r.json()] == [second["code"], first["code"]]
    assert set(r.json()[0]) == {"id", "code", "info", "device", "device_model", "created_at", "status", "status_info",
                                "source", "source_label", "courier_visit_at", "delivery_status"}

    # заявки другого клиента не видны
    client.post("/auth/client/logout")
    register(login="petr", number="+79990001122", email="petr@example.com", FIO="Пётр")
    login(client, "petr")
    assert client.get("/client/applications").json() == []
    client.post("/client/applications", json=APPLICATION)
    assert len(client.get("/client/applications").json()) == 1


def test_operator_application_of_registered_client_appears_in_his_list(client, staff, logged_client):
    r = client.post("/operator/add_application",
                    json={**APPLICATION, "FIO": "Иван Петров", "number": "+79161112233", "email": "ivan@example.com"},
                    headers=staff["operator"])
    assert r.status_code == 200, r.text
    assert [a["code"] for a in client.get("/client/applications").json()] == [r.json()["code"]]


def test_operator_application_requires_address(client, staff):
    body = {**APPLICATION, "FIO": "Иван", "number": "+79161234567", "email": "i@example.com"}
    for address in [None, "", "   "]:
        payload = {**body, "address": address} if address is not None else {k: v for k, v in body.items() if k != "address"}
        assert client.post("/operator/add_application", json=payload, headers=staff["operator"]).status_code == 422
    r = client.post("/operator/add_application", json={**body, "address": "  Москва  "}, headers=staff["operator"])
    assert r.status_code == 200
    application = get_application(client, staff["repairer"], r.json()["id"])
    assert application["address"] == "Москва" and application["created_at"]


def test_client_application_validation(client, logged_client):
    for field in ("info", "device", "device_model", "address", "courier_visit_at"):
        payload = {k: v for k, v in APPLICATION.items() if k != field}
        assert client.post("/client/applications", json=payload).status_code == 422
    assert client.post("/client/applications", json={**APPLICATION, "address": "   "}).status_code == 422
    assert client.post("/client/applications", json={**APPLICATION, "info": "Я" * 1001}).status_code == 422
    assert client.get("/client/applications").json() == []


def test_client_cannot_set_foreign_fields(client, logged_client):
    # лишние поля (чужой client_id, статус) игнорируются
    r = client.post("/client/applications", json={**APPLICATION, "client_id": 999, "status_info": 4, "code": "AAAAAAAA"})
    assert r.status_code == 201 and r.json()["code"] != "AAAAAAAA"
    assert len(client.get("/client/applications").json()) == 1


def test_requires_client_login(client, staff):
    assert client.post("/client/applications", json=APPLICATION).status_code == 401
    assert client.get("/client/applications").status_code == 401
    # токен сотрудника не дает доступ к ручкам клиента
    assert client.get("/client/applications", headers=staff["operator"]).status_code == 401


def test_status_code_format_and_case(client, logged_client):
    code = client.post("/client/applications", json=APPLICATION).json()["code"]
    assert client.get("/client/status", params={"application_code": code.lower()}).status_code == 200
    assert client.get("/client/status", params={"application_code": f" {code} "}).status_code == 200
    for bad in ["a\x00bcdefg", "\x00", "ABC", "ABCDEFGHI", "АБВГДЕЖЗ", "ABCD-123"]:
        assert client.get("/client/status", params={"application_code": bad}).status_code == 422
    assert client.get("/client/status", params={"application_code": "ZZZZZZZZ"}).status_code == 404


def test_nul_in_client_login_and_clients_search(client, staff, logged_client):
    assert client.post("/auth/client/login", json={"username": "a\x00b", "password": "password123"}).status_code == 422
    assert client.get("/operator/clients", params={"search": "a\x00b"}, headers=staff["operator"]).status_code == 422
