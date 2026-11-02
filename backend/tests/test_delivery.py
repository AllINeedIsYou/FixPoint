from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest

from src.models import (Stage, STATUS_CREATED, STATUS_ONLINE_CREATED, STATUS_COURIER_DISPATCHED,
                        STATUS_COURIER_PICKED_UP, STATUS_ARRIVED)
from .conftest import get_application, diagnose, check


@pytest.fixture
def online_payload():
    return {
        "info": "Не включается", "device": "Ноутбук", "device_model": "Lenovo",
        "address": "Москва, ул. Ленина, 1",
        "courier_visit_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
    }


@pytest.fixture
def online_customer(client):
    profile = {"FIO": "Онлайн клиент", "number": "+79163334455", "email": "online@example.com",
               "login": "online_client", "password": "client-password123"}
    assert client.post("/auth/client/register", json=profile).status_code == 201
    assert client.post("/auth/client/login", json={"username": profile["login"], "password": profile["password"]}).status_code == 200
    return profile


@pytest.fixture
def online_application(client, online_customer, online_payload):
    response = client.post("/client/applications", json=online_payload)
    assert response.status_code == 201, response.text
    return response.json()


def move(client, staff, app_id, target):
    return client.post(f"/operator/{app_id}/delivery", json={"status": target}, headers=staff["operator"])


def arrive(client, staff, app_id):
    for target in ["courier_dispatched", "courier_picked_up", "arrived"]:
        response = move(client, staff, app_id, target)
        assert response.status_code == 200, response.text
    return response.json()


def test_online_source_visit_time_and_full_repair_flow(client, staff, online_application, online_payload):
    app = online_application
    assert app["source"] == "online" and app["source_label"] == "Онлайн"
    assert app["status"] == STATUS_ONLINE_CREATED and app["status_info"] == Stage.ONLINE_CREATED
    assert app["delivery_status"] == "created"
    assert datetime.fromisoformat(app["courier_visit_at"]) == datetime.fromisoformat(online_payload["courier_visit_at"])

    steps = [
        ("courier_dispatched", Stage.COURIER_DISPATCHED, STATUS_COURIER_DISPATCHED),
        ("courier_picked_up", Stage.COURIER_PICKED_UP, STATUS_COURIER_PICKED_UP),
        ("arrived", Stage.CREATED, STATUS_ARRIVED),
    ]
    for target, stage, label in steps:
        before = get_application(client, staff["repairer"], app["id"])
        assert before["next_delivery_status"] == target
        assert before["next_delivery_action"]
        response = move(client, staff, app["id"], target)
        assert response.status_code == 200, response.text
        assert response.json()["status_info"] == stage and response.json()["status"] == label
        assert response.json()["delivery_status"] == target
        current = client.get("/client/applications").json()[0]
        assert current["status"] == label and current["delivery_status"] == target
        assert label in client.get("/client/status", params={"application_code": app["code"]}).json()

    assert response.json()["next_delivery_status"] is None
    assert response.json()["next_delivery_action"] is None
    assert client.post(f"/engineer/{app['id']}/takeEngineer", headers=staff["engineer"]).status_code == 200
    assert diagnose(client, staff["engineer"], app["id"]).status_code == 200
    assert client.post(f"/repairer/{app['id']}/takeRepair", headers=staff["repairer"]).status_code == 200
    assert client.post(f"/repairer/{app['id']}/repair", headers=staff["repairer"]).status_code == 200
    assert check(client, staff["engineer"], app["id"]).status_code == 200
    response = client.post(f"/operator/{app['id']}/issue", headers=staff["operator"])
    assert response.status_code == 200 and response.json()["status_info"] == Stage.ISSUED
    assert response.json()["source"] == "online" and response.json()["delivery_status"] == "arrived"
    assert move(client, staff, app["id"], "courier_dispatched").status_code == 409


def test_offline_source_needs_no_courier(client, staff, new_application):
    app_id = new_application()
    app = get_application(client, staff["repairer"], app_id)
    assert app["source"] == "offline" and app["source_label"] == "Офлайн"
    assert app["courier_visit_at"] is None and app["delivery_status"] is None
    assert app["next_delivery_status"] is None and app["next_delivery_action"] is None
    assert app["status"] == STATUS_CREATED and app["status_info"] == Stage.CREATED
    assert move(client, staff, app_id, "courier_dispatched").status_code == 400
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"]).status_code == 200


def test_online_price_with_parts_and_after_their_removal(client, staff, stock, online_application):
    app_id = online_application["id"]
    app = get_application(client, staff["repairer"], app_id)
    assert app["work_cost"] == 6000 and app["total_cost"] == 6000
    arrive(client, staff, app_id)
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"]).status_code == 200
    assert diagnose(client, staff["engineer"], app_id).status_code == 200
    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"]).status_code == 200
    stock("Экран", 1500, 5)
    response = client.post(f"/repairer/{app_id}/parts", json={"name": "Экран", "quantity": 2}, headers=staff["repairer"])
    assert response.status_code == 200, response.text
    assert response.json()["work_cost"] == 6000
    assert response.json()["parts_cost"] == 3000 and response.json()["total_cost"] == 9000
    part_id = response.json()["parts"][0]["id"]
    response = client.delete(f"/repairer/{app_id}/parts/{part_id}", headers=staff["repairer"])
    assert response.status_code == 200
    assert response.json()["work_cost"] == 6000 and response.json()["total_cost"] == 6000
    assert response.json()["parts_cost"] == 0


def test_delivery_rejects_skips_repeats_and_backwards_changes(client, staff, online_application):
    app_id = online_application["id"]
    assert move(client, staff, app_id, "arrived").status_code == 409
    assert move(client, staff, app_id, "courier_picked_up").status_code == 409
    assert move(client, staff, app_id, "courier_dispatched").status_code == 200
    assert move(client, staff, app_id, "courier_dispatched").status_code == 409
    assert move(client, staff, app_id, "arrived").status_code == 409
    assert move(client, staff, app_id, "courier_picked_up").status_code == 200
    assert move(client, staff, app_id, "courier_dispatched").status_code == 409
    assert move(client, staff, app_id, "arrived").status_code == 200
    assert move(client, staff, app_id, "arrived").status_code == 409


def test_repair_actions_blocked_at_every_courier_stage(client, staff, online_application):
    app_id = online_application["id"]
    for next_step in ["courier_dispatched", "courier_picked_up", "arrived"]:
        response = client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
        assert response.status_code == 400 and "прибытия" in response.json()["detail"]
        assert diagnose(client, staff["engineer"], app_id).status_code == 400
        assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"]).status_code == 400
        assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 400
        assert check(client, staff["engineer"], app_id).status_code == 400
        assert client.post(f"/operator/{app_id}/issue", headers=staff["operator"]).status_code == 400
        assert move(client, staff, app_id, next_step).status_code == 200


def test_failed_repair_check_does_not_restart_courier(client, staff, online_application):
    app_id = online_application["id"]
    arrive(client, staff, app_id)
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"]).status_code == 200
    assert diagnose(client, staff["engineer"], app_id).status_code == 200
    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"]).status_code == 200
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 200
    failed = check(client, staff["engineer"], app_id, passed=False, comment="Не включается")
    assert failed.status_code == 200 and failed.json()["status_info"] == Stage.CREATED
    assert failed.json()["delivery_status"] == "arrived" and failed.json()["next_delivery_status"] is None
    assert client.get("/operator/deliveries", headers=staff["operator"]).json() == []
    assert move(client, staff, app_id, "courier_dispatched").status_code == 409
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["other_engineer"]).status_code == 200


@pytest.mark.parametrize("role", ["engineer", "repairer"])
def test_only_operator_can_change_delivery(client, staff, online_application, role):
    response = client.post(f"/operator/{online_application['id']}/delivery", json={"status": "courier_dispatched"}, headers=staff[role])
    assert response.status_code == 403
    assert client.get("/operator/deliveries", headers=staff[role]).status_code == 403


def test_client_session_does_not_grant_operator_access(client, online_application):
    assert client.post(f"/operator/{online_application['id']}/delivery", json={"status": "courier_dispatched"}).status_code == 401
    assert client.get("/operator/deliveries").status_code == 401


@pytest.mark.parametrize("body", [{}, {"status": "created"}, {"status": "Готово"}, {"status": "arrived", "source": "offline"}])
def test_delivery_request_validation(client, staff, online_application, body):
    assert client.post(f"/operator/{online_application['id']}/delivery", json=body, headers=staff["operator"]).status_code == 422


def test_delivery_not_found(client, staff):
    assert move(client, staff, 999999, "courier_dispatched").status_code == 404


@pytest.mark.parametrize("value", [None, "2020-01-01T12:00:00+03:00", "2030-01-01T12:00:00", "not-a-date"])
def test_courier_visit_time_required_future_and_timezone_aware(client, online_customer, online_payload, value):
    payload = {**online_payload, "courier_visit_at": value}
    if value is None:
        del payload["courier_visit_at"]
    response = client.post("/client/applications", json=payload)
    assert response.status_code == 422, response.text
    assert client.get("/client/applications").json() == []


def test_courier_visit_timezone_preserved_as_same_instant(client, online_customer, online_payload):
    visit = (datetime.now(timezone.utc) + timedelta(days=3)).astimezone(timezone(timedelta(hours=3)))
    response = client.post("/client/applications", json={**online_payload, "courier_visit_at": visit.isoformat()})
    assert response.status_code == 201, response.text
    assert datetime.fromisoformat(response.json()["courier_visit_at"]) == visit


def test_client_cannot_forge_source_stage_or_delivery(client, online_customer, online_payload):
    response = client.post("/client/applications", json={
        **online_payload, "source": "offline", "status_info": 0, "delivery_status": "arrived", "client_id": 99999,
    })
    assert response.status_code == 201, response.text
    assert response.json()["source"] == "online" and response.json()["status_info"] == Stage.ONLINE_CREATED
    assert response.json()["delivery_status"] == "created"


def test_operator_endpoint_cannot_forge_online_source(client, staff, online_customer, online_payload):
    response = client.post("/operator/add_application", headers=staff["operator"], json={
        **online_payload, **online_customer, "source": "online", "status_info": -3,
    })
    assert response.status_code == 200, response.text
    app = get_application(client, staff["repairer"], response.json()["id"])
    assert app["source"] == "offline" and app["courier_visit_at"] is None


def test_delivery_queue_order_filters_and_completion(client, staff, online_customer, online_payload, new_application):
    later = client.post("/client/applications", json={**online_payload, "courier_visit_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()}).json()
    earlier = client.post("/client/applications", json=online_payload).json()
    new_application()
    response = client.get("/operator/deliveries", headers=staff["operator"])
    assert response.status_code == 200 and [a["id"] for a in response.json()] == [earlier["id"], later["id"]]
    assert move(client, staff, earlier["id"], "courier_dispatched").status_code == 200
    assert [a["id"] for a in client.get("/operator/deliveries", params={"status": "courier_dispatched"}, headers=staff["operator"]).json()] == [earlier["id"]]
    assert [a["id"] for a in client.get("/operator/deliveries", params={"status": "created"}, headers=staff["operator"]).json()] == [later["id"]]
    assert move(client, staff, earlier["id"], "courier_picked_up").status_code == 200
    assert move(client, staff, earlier["id"], "arrived").status_code == 200
    assert [a["id"] for a in client.get("/operator/deliveries", headers=staff["operator"]).json()] == [later["id"]]
    assert [a["id"] for a in client.get("/operator/deliveries", params={"status": "arrived"}, headers=staff["operator"]).json()] == [earlier["id"]]
    assert client.get("/operator/deliveries", params={"status": "invalid"}, headers=staff["operator"]).status_code == 422


def test_concurrent_duplicate_delivery_step(client, staff, online_application, db_session_factory):
    with db_session_factory() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("Проверка блокировки строки требует PostgreSQL")
    barrier = Barrier(2)
    def advance():
        barrier.wait(timeout=5)
        return move(client, staff, online_application["id"], "courier_dispatched").status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: advance(), range(2)))
    assert sorted(results) == [200, 409]
