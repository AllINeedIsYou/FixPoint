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
