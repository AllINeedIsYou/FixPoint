from conftest import diagnose, get_application, take_and_diagnose
from src.models import (Stage, STATUS_CREATED, STATUS_DIAGNOSTICS_TAKEN, STATUS_DIAGNOSED, STATUS_REPAIR_TAKEN,
                        STATUS_REPAIRED, STATUS_ISSUED)


def test_full_flow(client, staff, new_application):
    app_id = new_application()
    application = get_application(client, staff["repairer"], app_id)
    assert application["status_info"] == Stage.CREATED and application["status"] == STATUS_CREATED

    r = client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    assert r.status_code == 200 and r.json()["assignee_engineer_id"] == staff["engineer_id"]
    assert r.json()["status_info"] == Stage.CREATED and r.json()["status"] == STATUS_DIAGNOSTICS_TAKEN

    r = diagnose(client, staff["engineer"], app_id, info="  замена экрана ")
    assert r.status_code == 200 and r.json()["status_info"] == Stage.DIAGNOSED
    assert r.json()["diagnostic_result"] == "замена экрана" and r.json()["status"] == STATUS_DIAGNOSED

    r = client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"])
    assert r.status_code == 200 and r.json()["assignee_repairer_id"] == staff["repairer_id"]
    assert r.json()["status"] == STATUS_REPAIR_TAKEN

    r = client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"])
    assert r.status_code == 200 and r.json()["status_info"] == Stage.REPAIRED and r.json()["status"] == STATUS_REPAIRED

    r = client.post(f"/operator/{app_id}/issue", headers=staff["operator"])
    assert r.status_code == 200 and r.json()["status_info"] == Stage.ISSUED and r.json()["status"] == STATUS_ISSUED
    assert STATUS_ISSUED in client.get("/client/status", params={"application_id": app_id}).json()


def test_repeat_diagnostics_forbidden(client, staff, new_application):
    app_id = new_application()
    take_and_diagnose(client, staff["engineer"], app_id)
    assert diagnose(client, staff["engineer"], app_id).status_code == 400
    assert get_application(client, staff["repairer"], app_id)["status_info"] == 1


def test_diagnostic_info_required(client, staff, new_application):
    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    url = f"/engineer/{app_id}/diagnose"
    assert client.post(url, headers=staff["engineer"]).status_code == 422
    for info in ["", "   ", "Я" * 1001]:
        assert diagnose(client, staff["engineer"], app_id, info=info).status_code == 422
    # результат диагностики теперь только в теле, в URL больше не принимается
    assert client.post(url, params={"diagnostic_info": "d"}, headers=staff["engineer"]).status_code == 422
    assert get_application(client, staff["repairer"], app_id)["status_info"] == Stage.CREATED


def test_repair_before_diagnostics_forbidden(client, staff, new_application):
    app_id = new_application()
    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"]).status_code == 400
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 400


def test_repeat_repair_forbidden(client, staff, application_in_repair):
    client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"])
    assert client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"]).status_code == 400
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == 2


def test_repair_only_by_assignee(client, staff, new_application):
    app_id = new_application()
    take_and_diagnose(client, staff["engineer"], app_id)
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 400

    client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"])
    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["other_repairer"]).status_code == 400
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["other_repairer"]).status_code == 403
    assert get_application(client, staff["repairer"], app_id)["status_info"] == 1
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 200


def test_not_found(client, staff):
    assert client.post("/engineer/999/takeEngineer", headers=staff["engineer"]).status_code == 404
    assert client.post("/repairer/999/takeRepair", headers=staff["repairer"]).status_code == 404
    assert client.post("/repairer/999/repair", headers=staff["repairer"]).status_code == 404


# --- бронирование заявки мастером диагностики ---

def test_diagnostics_requires_booking(client, staff, new_application):
    app_id = new_application()
    r = diagnose(client, staff["engineer"], app_id)
    assert r.status_code == 400 and "сначала возьмите" in r.json()["detail"]
    assert get_application(client, staff["repairer"], app_id)["status_info"] == 0


def test_only_booked_engineer_can_diagnose(client, staff, new_application):
    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])

    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["other_engineer"]).status_code == 400
    assert diagnose(client, staff["other_engineer"], app_id).status_code == 403
    assert get_application(client, staff["repairer"], app_id)["status_info"] == 0

    assert diagnose(client, staff["engineer"], app_id).status_code == 200


def test_cannot_book_diagnosed_application(client, staff, new_application):
    app_id = new_application()
    take_and_diagnose(client, staff["engineer"], app_id)
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"]).status_code == 400


def test_booking_only_engineer_role(client, staff, new_application):
    app_id = new_application()
    assert client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["repairer"]).status_code == 403
    assert client.post(f"/engineer/{app_id}/takeEngineer").status_code == 401
    assert diagnose(client, staff["repairer"], app_id).status_code == 403


def test_status_texts_have_no_typos():
    texts = [STATUS_CREATED, STATUS_DIAGNOSTICS_TAKEN, STATUS_DIAGNOSED, STATUS_REPAIR_TAKEN, STATUS_REPAIRED, STATUS_ISSUED]
    assert not any(typo in text for text in texts for typo in ["завершина", "диагностки", " .", ",О"])


# --- выдача устройства клиенту ---

def test_issue_only_after_repair(client, staff, new_application, application_in_repair):
    app_id = new_application()
    assert client.post(f"/operator/{app_id}/issue", headers=staff["operator"]).status_code == 400
    take_and_diagnose(client, staff["engineer"], app_id)
    assert client.post(f"/operator/{app_id}/issue", headers=staff["operator"]).status_code == 400

    r = client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"])
    assert r.status_code == 400 and "не завершён" in r.json()["detail"]
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == Stage.DIAGNOSED


def test_repeat_issue_forbidden(client, staff, application_in_repair):
    client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"])
    assert client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"]).status_code == 200
    r = client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"])
    assert r.status_code == 400 and "уже выдано" in r.json()["detail"]


def test_issued_application_is_closed(client, staff, stock, application_in_repair):
    stock("Провода", 50, 10)
    client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"])
    client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"])

    assert client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"]).status_code == 400
    r = client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода"}, headers=staff["repairer"])
    assert r.status_code == 400
    assert client.post(f"/repairer/{application_in_repair}/release", headers=staff["repairer"]).status_code == 400
    assert client.post(f"/operator/{application_in_repair}/release", headers=staff["operator"]).status_code == 400
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == Stage.ISSUED


def test_issue_access(client, staff, application_in_repair):
    client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"])
    assert client.post(f"/operator/{application_in_repair}/issue", headers=staff["repairer"]).status_code == 403
    assert client.post(f"/operator/{application_in_repair}/issue").status_code == 401
    assert client.post("/operator/999/issue", headers=staff["operator"]).status_code == 404


# --- снятие брони ---

def test_engineer_releases_booking(client, staff, new_application):
    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])

    assert client.post(f"/engineer/{app_id}/release", headers=staff["other_engineer"]).status_code == 403
    r = client.post(f"/engineer/{app_id}/release", headers=staff["engineer"])
    assert r.status_code == 200 and r.json()["assignee_engineer_id"] is None and r.json()["status"] == STATUS_CREATED
    assert client.post(f"/engineer/{app_id}/release", headers=staff["engineer"]).status_code == 400

    # освободившуюся заявку берет и диагностирует другой инженер
    take_and_diagnose(client, staff["other_engineer"], app_id)
    assert client.post(f"/engineer/{app_id}/release", headers=staff["other_engineer"]).status_code == 400


def test_repairer_releases_booking_parts_stay(client, staff, stock, application_in_repair):
    stock("Провода", 50, 10)
    client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода", "quantity": 2}, headers=staff["repairer"])

    assert client.post(f"/repairer/{application_in_repair}/release", headers=staff["other_repairer"]).status_code == 403
    r = client.post(f"/repairer/{application_in_repair}/release", headers=staff["repairer"])
    assert r.status_code == 200 and r.json()["assignee_repairer_id"] is None and r.json()["status"] == STATUS_DIAGNOSED
    assert r.json()["parts_cost"] == 100

    # бывший мастер больше не может работать с заявкой, новый продолжает с теми же запчастями
    assert client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"]).status_code == 400
    assert client.post(f"/repairer/{application_in_repair}/takeRepair", headers=staff["other_repairer"]).status_code == 200
    r = client.post(f"/repairer/{application_in_repair}/repair", headers=staff["other_repairer"])
    assert r.status_code == 200 and r.json()["parts_cost"] == 100


def test_operator_releases_engineer_and_repairer(client, staff, new_application):
    app_id = new_application()
    assert client.post(f"/operator/{app_id}/release", headers=staff["operator"]).status_code == 400

    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    r = client.post(f"/operator/{app_id}/release", headers=staff["operator"])
    assert r.status_code == 200 and r.json()["assignee_engineer_id"] is None and r.json()["status"] == STATUS_CREATED

    take_and_diagnose(client, staff["other_engineer"], app_id)
    assert client.post(f"/operator/{app_id}/release", headers=staff["operator"]).status_code == 400
    client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"])
    r = client.post(f"/operator/{app_id}/release", headers=staff["operator"])
    assert r.status_code == 200 and r.json()["assignee_repairer_id"] is None and r.json()["status"] == STATUS_DIAGNOSED
    # инженер, который провел диагностику, остается в заявке
    assert r.json()["assignee_engineer_id"] is not None

    assert client.post(f"/repairer/{app_id}/takeRepair", headers=staff["other_repairer"]).status_code == 200


def test_release_access(client, staff, new_application):
    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    assert client.post(f"/engineer/{app_id}/release", headers=staff["repairer"]).status_code == 403
    assert client.post(f"/operator/{app_id}/release", headers=staff["engineer"]).status_code == 403
    assert client.post(f"/operator/{app_id}/release").status_code == 401
    for url in ["/engineer/999/release", "/repairer/999/release"]:
        assert client.post(url, headers=staff[url.split("/")[1]]).status_code == 404
    assert client.post("/operator/999/release", headers=staff["operator"]).status_code == 404
