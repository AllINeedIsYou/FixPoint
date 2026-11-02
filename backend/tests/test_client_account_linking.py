from datetime import datetime, timedelta, timezone

import pytest

from src.models import Application, Client, STATUS_DIAGNOSTICS_TAKEN


APPLICATION = {
    "info": "Не включается", "device": "Ноутбук", "device_model": "Lenovo",
    "address": "Москва, ул. Ленина, 1",
    "courier_visit_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
}


@pytest.fixture
def profile():
    return {
        "FIO": "Иван Петров", "number": "+79161234567", "email": "ivan@example.com",
        "login": "ivan", "password": "client-password123",
    }


def operator_application(client, staff, profile, **changes):
    payload = {**APPLICATION, **{k: profile[k] for k in ("FIO", "number", "email")}, **changes}
    response = client.post("/operator/add_application", json=payload, headers=staff["operator"])
    assert response.status_code == 200, response.text
    return response.json()


def login(client, profile):
    response = client.post("/auth/client/login", json={
        "username": profile["login"], "password": profile["password"],
    })
    assert response.status_code == 200, response.text


def test_operator_history_and_online_applications_share_one_account(client, staff, profile, db_session_factory):
    first = operator_application(client, staff, profile)
    second = operator_application(client, staff, profile, info="Разбит экран")
    with db_session_factory() as db:
        original_created_at = db.get(Client, first["client_id"]).created_at

    # После визита клиент активирует существующую карточку, а не создает дубль.
    response = client.post("/auth/client/register", json={
        **profile, "application_code": first["code"],
    })
    assert response.status_code == 201, response.text
    assert response.json()["id"] == first["client_id"] == second["client_id"]
    assert "application_code" not in response.json()
    login(client, profile)
    assert {a["code"] for a in client.get("/client/applications").json()} == {first["code"], second["code"]}

    online = client.post("/client/applications", json=APPLICATION)
    assert online.status_code == 201, online.text
    # Повторное обращение к оператору после регистрации тоже попадает сюда.
    third = operator_application(client, staff, profile)
    applications = client.get("/client/applications").json()
    assert {a["code"] for a in applications} == {first["code"], second["code"], third["code"], online.json()["code"]}
    with db_session_factory() as db:
        assert db.query(Client).count() == 1
        assert {a.client_id for a in db.query(Application)} == {first["client_id"]}
        assert db.get(Client, first["client_id"]).created_at == original_created_at

    # Кабинет получает актуальный статус той же заявки после действий сотрудника.
    response = client.post(f"/engineer/{first['id']}/takeEngineer", headers=staff["engineer"])
    assert response.status_code == 200, response.text
    current = next(a for a in client.get("/client/applications").json() if a["code"] == first["code"])
    assert current["id"] == first["id"]
    assert current["status"] == STATUS_DIAGNOSTICS_TAKEN
    assert current["status_info"] == 0


def test_online_account_then_operator_uses_existing_client(client, staff, profile, db_session_factory):
    registered = client.post("/auth/client/register", json=profile)
    assert registered.status_code == 201
    login(client, profile)
    online = client.post("/client/applications", json=APPLICATION).json()
    offline = operator_application(client, staff, profile, number="+7 (916) 123-45-67")
    assert offline["client_id"] == registered.json()["id"]
    assert {a["code"] for a in client.get("/client/applications").json()} == {online["code"], offline["code"]}
    with db_session_factory() as db:
        assert db.query(Client).count() == 1


def test_activation_normalizes_phone_name_email_and_code(client, staff, profile):
    application = operator_application(client, staff, profile)
    response = client.post("/auth/client/register", json={
        **profile, "number": "+7 (916) 123-45-67", "FIO": "  иван петров  ",
        "email": "IVAN@example.com", "application_code": f" {application['code'].lower()} ",
    })
    assert response.status_code == 201, response.text
    assert response.json()["id"] == application["client_id"]
    assert response.json()["FIO"] == profile["FIO"]


@pytest.mark.parametrize("proof,expected", [(None, 409), ("ZZZZZZZZ", 403)])
def test_personal_data_without_valid_proof_cannot_claim_history(client, staff, profile, db_session_factory, proof, expected):
    application = operator_application(client, staff, profile)
    response = client.post("/auth/client/register", json={**profile, "application_code": proof})
    assert response.status_code == expected
    with db_session_factory() as db:
        customer = db.get(Client, application["client_id"])
        assert customer.login is None and customer.password_hash is None
    assert client.post("/auth/client/login", json={"username": profile["login"], "password": profile["password"]}).status_code == 401


@pytest.mark.parametrize("changed", [{"FIO": "Другой человек"}, {"email": "other@example.com"}, {"number": "+79991112233"}])
def test_activation_rejects_mismatched_personal_data(client, staff, profile, changed):
    application = operator_application(client, staff, profile)
    response = client.post("/auth/client/register", json={**profile, **changed, "application_code": application["code"]})
    assert response.status_code == 403


def test_foreign_application_code_cannot_claim_client(client, staff, profile):
    own = operator_application(client, staff, profile)
    foreign = operator_application(client, staff, profile, number="+79991112233")
    response = client.post("/auth/client/register", json={**profile, "application_code": foreign["code"]})
    assert response.status_code == 403
    assert client.post("/auth/client/register", json={**profile, "application_code": own["code"]}).status_code == 201
    login(client, profile)
    assert client.get("/client/status", params={"application_code": foreign["code"]}).status_code == 404
    assert [a["code"] for a in client.get("/client/applications").json()] == [own["code"]]


def test_existing_account_cannot_be_reset_using_application_code(client, staff, profile):
    assert client.post("/auth/client/register", json=profile).status_code == 201
    application = operator_application(client, staff, profile)
    response = client.post("/auth/client/register", json={
        **profile, "login": "attacker", "password": "different-password", "application_code": application["code"],
    })
    assert response.status_code == 409
    login(client, profile)
    assert client.post("/auth/client/login", json={"username": "attacker", "password": "different-password"}).status_code == 401


def test_taken_login_does_not_partially_activate_client(client, staff, profile, db_session_factory):
    assert client.post("/auth/client/register", json={**profile, "number": "+79991112233"}).status_code == 201
    application = operator_application(client, staff, profile)
    response = client.post("/auth/client/register", json={**profile, "application_code": application["code"]})
    assert response.status_code == 409
    with db_session_factory() as db:
        customer = db.get(Client, application["client_id"])
        assert customer.login is None and customer.password_hash is None
    response = client.post("/auth/client/register", json={**profile, "login": "ivan_new", "application_code": application["code"]})
    assert response.status_code == 201, response.text


@pytest.mark.parametrize("code", ["123", "ABCD-123", "АБВГДЕЖЗ", "abcdefgh\x00"])
def test_activation_code_validation(client, profile, code):
    assert client.post("/auth/client/register", json={**profile, "application_code": code}).status_code == 422
