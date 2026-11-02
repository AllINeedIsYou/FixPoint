import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest

from src.models import Application, Client, ClientSessions
from src.shemas import ClientCreateShema


@pytest.fixture
def client_data():
    return {
        "FIO": "Иван Петров",
        "number": "+79161234567",
        "email": "ivan@example.com",
        "login": "ivan",
        "password": "test-password",
    }


@pytest.fixture
def registered_client(client, client_data):
    response = client.post("/auth/client/register", json=client_data)
    assert response.status_code == 201, response.text
    return response.json()


def login(client, client_data):
    return client.post(
        "/auth/client/login",
        json={"username": client_data["login"], "password": client_data["password"]},
    )


def test_registration_uses_password_hash_and_safe_response(client, client_data, db_session_factory):
    response = client.post("/auth/client/register", json=client_data)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["login"] == client_data["login"]
    assert "password" not in data and "password_hash" not in data
    with db_session_factory() as db:
        record = db.get(Client, data["id"])
        from src.auth.auth import verify_password
        assert record.password_hash.startswith("scrypt$")
        assert verify_password(client_data["password"], record.password_hash)
        assert record.created_at is not None


@pytest.mark.parametrize("field", ["login", "number"])
def test_registration_conflicts(client, client_data, registered_client, field):
    data = {**client_data, "login": "other", "number": "+79991112233"}
    data[field] = client_data[field]
    assert client.post("/auth/client/register", json=data).status_code == 409
    assert login(client, client_data).status_code == 200


@pytest.mark.parametrize("changes", [
    {"password": "short"},
    {"password": "abcdefgh\x00"},
    {"password": "abcdefgh\ud800"},
    {"login": "x" * 41},
    {"FIO": " "},
    {"email": "invalid"},
    {"number": "invalid"},
])
def test_invalid_registration(client, client_data, changes):
    response = client.post("/auth/client/register", content=json.dumps({**client_data, **changes}), headers={"Content-Type": "application/json"})
    assert response.status_code == 422, response.text
    assert "password_hash" not in response.text


def test_password_spaces_preserved(client, client_data):
    client_data["password"] = " password with spaces "
    assert client.post("/auth/client/register", json=client_data).status_code == 201
    assert login(client, client_data).status_code == 200
    client_data["password"] = client_data["password"].strip()
    assert login(client, client_data).status_code == 401


def test_login_cookie_and_me(client, client_data, registered_client, db_session_factory):
    response = login(client, client_data)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == registered_client["id"]
    assert "password" not in response.json() and "password_hash" not in response.json()
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    token = client.cookies.get("client_session")
    with db_session_factory() as db:
        entry = db.query(ClientSessions).one()
        assert entry.client_id == registered_client["id"]
        assert entry.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert entry.token_hash != token
        assert entry.expires_at - entry.created_at == timedelta(days=7)
    response = client.get("/auth/client/me")
    assert response.status_code == 200
    assert response.json()["id"] == registered_client["id"]


@pytest.mark.parametrize("username,password", [("missing", "test-password"), ("ivan", "wrong")])
def test_bad_login(client, registered_client, db_session_factory, username, password):
    response = client.post("/auth/client/login", json={"username": username, "password": password})
    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    with db_session_factory() as db:
        assert db.query(ClientSessions).count() == 0


def test_missing_invalid_and_expired_session(client, client_data, registered_client, db_session_factory):
    assert client.get("/auth/client/me").status_code == 401
    assert client.get("/client/status", params={"application_id": 1}).status_code == 401
    assert client.get("/auth/client/me", headers={"Cookie": "client_session=wrong"}).status_code == 401
    assert login(client, client_data).status_code == 200
    with db_session_factory() as db:
        db.query(ClientSessions).one().expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get("/auth/client/me").status_code == 401
    assert client.get("/client/status", params={"application_id": 1}).status_code == 401


def test_client_can_only_view_own_application(client, client_data, registered_client, db_session_factory):
    with db_session_factory() as db:
        own = Application(client_id=registered_client["id"], info="own", device="phone", device_model="model", address="Москва", code="OWN12345")
        other_client = Client(FIO="Другой", number="+79991112233", email="other@example.com")
        other = Application(client=other_client, info="other", device="phone", device_model="model", address="Москва", code="OTHER123")
        db.add_all([own, other])
        db.commit()
    assert login(client, client_data).status_code == 200
    response = client.get("/client/status", params={"application_code": "own12345"})
    assert response.status_code == 200 and client_data["FIO"] in response.json()
    assert client.get("/client/status", params={"application_code": "OTHER123"}).status_code == 404
    assert client.get("/client/status", params={"application_code": "MISSING1"}).status_code == 404
    assert client.get("/client/status", params={"application_code": "invalid"}).status_code == 422
    assert client.get("/client/status").status_code == 422


def test_logout_revokes_only_current_session(client, client_data, registered_client):
    assert login(client, client_data).status_code == 200
    first_token = client.cookies.get("client_session")
    assert login(client, client_data).status_code == 200
    second_token = client.cookies.get("client_session")
    response = client.post("/auth/client/logout")
    assert response.status_code == 204 and response.content == b""
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert client.get("/auth/client/me").status_code == 401
    assert client.get("/auth/client/me", headers={"Cookie": f"client_session={second_token}"}).status_code == 401
    assert client.get("/auth/client/me", headers={"Cookie": f"client_session={first_token}"}).status_code == 200
    assert client.post("/auth/client/logout").status_code == 204


def test_client_cookie_does_not_grant_employee_access(client, client_data, registered_client):
    assert login(client, client_data).status_code == 200
    assert client.get("/operator/clients").status_code == 401


def test_employee_token_does_not_grant_client_access(client, employee):
    _, headers = employee("operator", "Оператор")
    assert client.get("/client/status", params={"application_id": 1}, headers=headers).status_code == 401


def test_operator_can_still_create_clients_without_accounts(client, employee, db_session_factory):
    _, headers = employee("operator", "Оператор")
    response = client.post("/operator/add_application", headers=headers, json={
        "FIO": "Иван Петров",
        "number": "+79161234567",
        "email": "ivan@example.com",
        "info": "не включается",
        "device": "phone",
        "device_model": "model",
        "address": "Москва",
    })
    assert response.status_code == 200, response.text
    result = client.get("/operator/clients", headers=headers)
    assert result.status_code == 200
    assert result.json()[0]["application_ids"] == [response.json()["id"]]
    with db_session_factory() as db:
        profile = db.query(Client).one()
        assert profile.login is None and profile.password_hash is None
        assert profile.created_at is not None
        application = db.get(Application, response.json()["id"])
        assert application.device == "phone" and application.device_model == "model"
        assert len(application.code) == 8 and application.code == response.json()["code"]


def test_registration_does_not_claim_existing_client(client, client_data, db_session_factory):
    data = ClientCreateShema.model_validate(client_data)
    with db_session_factory() as db:
        db.add(Client(FIO=data.FIO, number=str(data.number), email=str(data.email)))
        db.commit()
    assert client.post("/auth/client/register", json=client_data).status_code == 409
