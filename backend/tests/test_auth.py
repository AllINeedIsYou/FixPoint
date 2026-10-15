import pytest


@pytest.fixture
def code(client):
    r = client.post("/services/access-codes", json={"role": "repairer", "FIO": "Мастер"})
    return r.json()["code"]


@pytest.mark.parametrize("form", [
    {},                                  # только код
    {"password": ""},                    # пустой пароль, как шлет swagger
    {"password": "x"},                   # старый костыль тоже работает
    {"password": "", "grant_type": "password", "scope": ""},
])
def test_login_by_code_without_password(client, code, form):
    r = client.post("/auth/login", data={"username": code, **form})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "repairer"

    token = r.json()["access_token"]
    assert client.get("/repairer/get_applications", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_wrong_code(client, code):
    assert client.post("/auth/login", data={"username": "WRONG"}).status_code == 401


def test_no_code(client):
    assert client.post("/auth/login", data={}).status_code == 422


def test_dismissed_employee_cannot_login(client, code):
    employee_id = client.get("/services/get_accesscode").json()[0]["id"]
    client.patch(f"/services/{employee_id}/dismissal")
    assert client.post("/auth/login", data={"username": code}).status_code == 401


def test_swagger_shows_login_hint(client):
    scheme = client.get("/openapi.json").json()["components"]["securitySchemes"]["OAuth2PasswordBearer"]
    assert "оставьте пустым" in scheme["description"]


def test_dismissed_employee_token_stops_working(client, code):
    token = client.post("/auth/login", data={"username": code}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    employee_id = client.get("/services/get_accesscode").json()[0]["id"]
    assert client.get("/repairer/get_applications", headers=headers).status_code == 200

    client.patch(f"/services/{employee_id}/dismissal")
    r = client.get("/repairer/get_applications", headers=headers)
    assert r.status_code == 401 and "уволен" in r.json()["detail"]

    client.patch(f"/services/{employee_id}/hier")
    assert client.get("/repairer/get_applications", headers=headers).status_code == 200


def test_token_of_deleted_or_fake_employee(client):
    from src.auth.auth import create_access_token
    for sub in ["999", "abc", None]:
        data = {"role": "repairer"} if sub is None else {"sub": sub, "role": "repairer"}
        headers = {"Authorization": f"Bearer {create_access_token(data)}"}
        assert client.get("/repairer/get_applications", headers=headers).status_code == 401


def test_client_password_is_salted_scrypt(client, db_session_factory):
    from src.models import Client
    body = {"FIO": "Иван", "number": "+79161112233", "email": "i@example.com", "password": "password123"}
    client.post("/auth/client/register", json={**body, "login": "first"})
    client.post("/auth/client/register", json={**body, "login": "second", "number": "+79161112244"})
    with db_session_factory() as db:
        hashes = [c.password_hash for c in db.query(Client).order_by(Client.id)]
    assert all(h.startswith("scrypt$") and "password123" not in h for h in hashes)
    # одинаковые пароли - разные хеши (соль)
    assert hashes[0] != hashes[1]
    assert client.post("/auth/client/login", json={"username": "first", "password": "password123"}).status_code == 200
    assert client.post("/auth/client/login", json={"username": "first", "password": "password124"}).status_code == 401


def test_legacy_sha256_password_still_works_and_is_upgraded(client, db_session_factory):
    from src.auth.auth import hash_code
    from src.models import Client
    with db_session_factory() as db:
        db.add(Client(FIO="Старый", number="tel:+7-916-111-22-55", email="o@example.com", login="old",
                      password_hash=hash_code("password123")))
        db.commit()
    assert client.post("/auth/client/login", json={"username": "old", "password": "wrong-pass"}).status_code == 401
    assert client.post("/auth/client/login", json={"username": "old", "password": "password123"}).status_code == 200
    with db_session_factory() as db:
        assert db.query(Client).filter(Client.login == "old").one().password_hash.startswith("scrypt$")
    assert client.post("/auth/client/login", json={"username": "old", "password": "password123"}).status_code == 200


def test_expired_sessions_are_removed_on_login(client, db_session_factory):
    from datetime import datetime, timedelta, timezone
    from src.models import ClientSessions
    body = {"FIO": "Иван", "number": "+79161112233", "email": "i@example.com", "login": "ivan", "password": "password123"}
    client_id = client.post("/auth/client/register", json=body).json()["id"]
    old = datetime.now(timezone.utc) - timedelta(days=30)
    with db_session_factory() as db:
        db.add(ClientSessions(client_id=client_id, token_hash="x" * 64, created_at=old, expires_at=old))
        db.commit()
    client.post("/auth/client/login", json={"username": "ivan", "password": "password123"})
    with db_session_factory() as db:
        assert [s.token_hash for s in db.query(ClientSessions)] != [] and "x" * 64 not in [s.token_hash for s in db.query(ClientSessions)]
