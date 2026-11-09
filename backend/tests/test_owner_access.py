from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import jwt
import pytest
from sqlalchemy.exc import IntegrityError

from src.auth.auth import SECRET_KEY, create_access_token, hash_code
from src.auth.owner import initialize_owner
from src.models import AccessCode, OwnerAccessCode


ADMIN_ROUTES = [
    ("GET", "/services/get_applications", None),
    ("GET", "/services/get_accesscode", None),
    ("GET", "/services/stocks", None),
    ("GET", "/services/stock", None),
    ("POST", "/services/database_create", None),
    ("POST", "/services/access-codes", {"role": "operator", "FIO": "Новый"}),
    ("POST", "/services/reload-access-code", {"id": 99999}),
    ("PATCH", "/services/99999/dismissal", None),
    ("PATCH", "/services/99999/hier", None),
    ("POST", "/services/stock", {"name": "Экран", "price": 100, "quantity": 2}),
    ("PATCH", "/services/stock/99999", {"price": 100}),
    ("POST", "/services/99999/release", None),
]


@pytest.mark.parametrize("method,path,body", ADMIN_ROUTES)
def test_every_admin_route_requires_login(client, method, path, body):
    assert client.request(method, path, json=body).status_code == 401


@pytest.mark.parametrize("role", ["operator", "engineer", "repairer"])
def test_staff_cannot_use_any_admin_route(client, employee, role):
    _, headers = employee(role, f"Проверка {role}")
    for method, path, body in ADMIN_ROUTES:
        response = client.request(method, path, json=body, headers=headers)
        assert response.status_code == 403, (method, path, response.text)


def test_all_five_codes_login_to_one_owner_and_are_not_consumed(client, owner, db_session_factory):
    owner_id, _, codes = owner
    assert len(set(codes)) == 5
    assert all(len(code) == 15 and code.isascii() and code.isalnum() for code in codes)
    for _ in range(2):
        for code in codes:
            response = client.post("/auth/login", data={"username": code})
            assert response.status_code == 200, response.text
            assert response.json()["role"] == "owner"
            payload = jwt.decode(response.json()["access_token"], SECRET_KEY, algorithms=["HS256"])
            assert payload["sub"] == str(owner_id)
            headers = {"Authorization": "Bearer " + response.json()["access_token"]}
            assert client.get("/services/get_applications", headers=headers).status_code == 200
    with db_session_factory() as db:
        assert db.query(AccessCode).filter_by(role="owner").count() == 1
        keys = db.query(OwnerAccessCode).all()
        assert len(keys) == 5 and {key.owner_id for key in keys} == {owner_id}
        assert {key.code_hash for key in keys} == {hash_code(code) for code in codes}
        assert not any(key.code_hash in codes for key in keys)


def test_owner_tokens_expire_but_codes_still_work(client, owner):
    expired = jwt.encode({"sub": str(owner[0]), "role": "owner", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}, SECRET_KEY, algorithm="HS256")
    assert client.get("/services/stock", headers={"Authorization": "Bearer " + expired}).status_code == 401
    for code in owner[2]:
        assert client.post("/auth/login", data={"username": code}).status_code == 200


def test_owner_only_accepts_five_keys_not_primary_employee_code(client, owner, db_session_factory):
    with db_session_factory() as db:
        db.get(AccessCode, owner[0]).code_hash = hash_code("NOT-AN-OWNER-KEY")
        db.commit()
    assert client.post("/auth/login", data={"username": "NOT-AN-OWNER-KEY"}).status_code == 401
    assert client.post("/auth/login", data={"username": owner[2][0]}).status_code == 200


def test_bootstrap_cannot_create_another_owner_or_replace_codes(owner, db_session_factory):
    with db_session_factory() as db:
        before = [(key.slot, key.code_hash) for key in db.query(OwnerAccessCode).order_by(OwnerAccessCode.slot)]
        with pytest.raises(ValueError, match="уже создан"):
            initialize_owner(db)
        after = [(key.slot, key.code_hash) for key in db.query(OwnerAccessCode).order_by(OwnerAccessCode.slot)]
        assert after == before
        db.add(AccessCode(FIO="Другой владелец", role="owner", code_hash=hash_code("second"), is_active=True))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.query(AccessCode).filter_by(role="owner").count() == 1


def test_no_sixth_owner_key(owner, db_session_factory):
    with db_session_factory() as db:
        db.add(OwnerAccessCode(slot=6, owner_id=owner[0], code_hash=hash_code("sixth")))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.query(OwnerAccessCode).count() == 5


def test_owner_creates_admin_and_admin_creates_ordinary_employee(client, owner):
    response = client.post("/services/access-codes", json={"role": "admin", "FIO": "Новый администратор"}, headers=owner[1])
    assert response.status_code == 200, response.text
    admin_id, admin_code = response.json()["id"], response.json()["code"]
    assert len(admin_code) == 12
    response = client.post("/auth/login", data={"username": admin_code})
    assert response.status_code == 200 and response.json()["role"] == "admin"
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    for role in ["operator", "engineer", "repairer"]:
        response = client.post("/services/access-codes", json={"role": role, "FIO": f"Новый {role}"}, headers=headers)
        assert response.status_code == 200, response.text
    assert client.post("/services/access-codes", json={"role": "admin", "FIO": "Повышение"}, headers=headers).status_code == 403
    assert client.post("/services/reload-access-code", json={"id": admin_id}, headers=headers).status_code == 403


def test_only_owner_can_reissue_block_and_restore_admin(client, owner, admin_headers, db_session_factory):
    response = client.post("/services/access-codes", json={"role": "admin", "FIO": "Управляемый админ"}, headers=owner[1])
    admin_id, old_code = response.json()["id"], response.json()["code"]
    token = client.post("/auth/login", data={"username": old_code}).json()["access_token"]
    target_headers = {"Authorization": "Bearer " + token}
    for route, body, method in [("reload-access-code", {"id": admin_id}, "POST"), (f"{admin_id}/dismissal", None, "PATCH"), (f"{admin_id}/hier", None, "PATCH")]:
        assert client.request(method, f"/services/{route}", json=body, headers=admin_headers).status_code == 403
    response = client.post("/services/reload-access-code", json={"id": admin_id}, headers=owner[1])
    assert response.status_code == 200, response.text
    assert client.post("/auth/login", data={"username": old_code}).status_code == 401
    assert client.post("/auth/login", data={"username": response.json()["Code"]}).status_code == 200
    assert client.patch(f"/services/{admin_id}/dismissal", headers=owner[1]).status_code == 200
    assert client.get("/services/stock", headers=target_headers).status_code == 401
    assert client.patch(f"/services/{admin_id}/hier", headers=owner[1]).status_code == 200


@pytest.mark.parametrize("actor", ["owner", "admin"])
def test_owner_cannot_be_created_blocked_or_reissued_via_api(client, owner, admin_headers, actor):
    headers = owner[1] if actor == "owner" else admin_headers
    assert client.post("/services/access-codes", json={"role": "owner", "FIO": "Второй владелец"}, headers=headers).status_code == 403
    assert client.post("/services/reload-access-code", json={"id": owner[0]}, headers=headers).status_code == 403
    assert client.patch(f"/services/{owner[0]}/dismissal", headers=headers).status_code == 403
    assert client.patch(f"/services/{owner[0]}/hier", headers=headers).status_code == 403
    assert all(client.post("/auth/login", data={"username": code}).status_code == 200 for code in owner[2])


def test_admin_and_owner_have_stock_and_application_access(client, owner, admin_headers):
    for index, headers in enumerate([admin_headers, owner[1]]):
        for path in ["get_applications", "get_accesscode", "stock", "stocks"]:
            assert client.get("/services/" + path, headers=headers).status_code == 200
        response = client.post("/services/stock", json={"name": f"Деталь {index}", "price": 10, "quantity": 1}, headers=headers)
        assert response.status_code == 200
        assert client.patch(f"/services/stock/{response.json()['id']}", json={"price": 20}, headers=headers).status_code == 200


def test_employee_lists_do_not_disclose_codes_hashes_or_owner(client, owner, admin_headers, employee):
    ordinary_id, _ = employee("operator", "Оператор списка")
    response = client.get("/services/get_accesscode", headers=admin_headers)
    assert [entry["id"] for entry in response.json()] == [ordinary_id]
    response = client.get("/services/get_accesscode", headers=owner[1])
    assert {entry["role"] for entry in response.json()} == {"admin", "operator"}
    for entry in response.json():
        assert set(entry) == {"id", "FIO", "role", "is_active"}
    assert not any(code in response.text for code in owner[2])


def test_database_create_preserves_owner_keys_and_employee_accounts(client, owner, admin_headers, db_session_factory):
    with db_session_factory() as db:
        before = [(key.slot, key.owner_id, key.code_hash) for key in db.query(OwnerAccessCode).order_by(OwnerAccessCode.slot)]
        staff_count = db.query(AccessCode).count()
    assert client.post("/services/database_create", headers=admin_headers).status_code == 200
    assert client.post("/services/database_create", headers=owner[1]).status_code == 200
    with db_session_factory() as db:
        assert db.query(AccessCode).count() == staff_count
        assert [(key.slot, key.owner_id, key.code_hash) for key in db.query(OwnerAccessCode).order_by(OwnerAccessCode.slot)] == before


@pytest.mark.parametrize("role", ["admin", "owner"])
def test_forged_role_on_real_staff_id_is_rejected(client, employee, role):
    employee_id, _ = employee("operator", "Без повышения")
    headers = {"Authorization": "Bearer " + create_access_token({"sub": str(employee_id), "role": role})}
    assert client.get("/services/stock", headers=headers).status_code == 401


def test_client_session_does_not_grant_admin_access(client):
    profile = {"FIO": "Клиент", "number": "+79161112233", "email": "client@example.com", "login": "client", "password": "password123"}
    assert client.post("/auth/client/register", json=profile).status_code == 201
    assert client.post("/auth/client/login", json={"username": "client", "password": "password123"}).status_code == 200
    assert client.get("/services/get_applications").status_code == 401


def test_concurrent_owner_initialization_creates_one_account(db_session_factory):
    with db_session_factory() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("Проверка конкурентной инициализации требует PostgreSQL")
    barrier = Barrier(2)
    def bootstrap(_):
        with db_session_factory() as db:
            barrier.wait(timeout=5)
            try:
                initialize_owner(db)
                return True
            except ValueError:
                return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(bootstrap, range(2))) == [False, True]
    with db_session_factory() as db:
        assert db.query(AccessCode).filter_by(role="owner").count() == 1
        assert db.query(OwnerAccessCode).count() == 5
