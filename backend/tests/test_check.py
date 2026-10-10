from conftest import check, get_application, repair_and_check, take_and_diagnose
from src.models import Stage, STATUS_CHECK_FAILED, STATUS_CHECKED, STATUS_DIAGNOSTICS_TAKEN, STATUS_REPAIRED


def repaired(client, staff, app_id):
    assert client.post(f"/repairer/{app_id}/repair", headers=staff["repairer"]).status_code == 200


def test_check_passed_then_issue(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    r = client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"])
    assert r.status_code == 400 and "не проверен" in r.json()["detail"]

    r = check(client, staff["engineer"], application_in_repair)
    assert r.status_code == 200 and r.json()["status_info"] == Stage.CHECKED and r.json()["status"] == STATUS_CHECKED
    assert client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"]).status_code == 200


def test_check_only_after_repair(client, staff, new_application, application_in_repair):
    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    assert check(client, staff["engineer"], app_id).status_code == 400
    r = check(client, staff["engineer"], application_in_repair)
    assert r.status_code == 400 and "не завершён" in r.json()["detail"]


def test_repeat_check_forbidden(client, staff, application_in_repair):
    repair_and_check(client, staff, application_in_repair)
    r = check(client, staff["engineer"], application_in_repair, passed=False, comment="передумал")
    assert r.status_code == 400 and "уже проверен" in r.json()["detail"]
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == Stage.CHECKED


def test_only_application_engineer_can_check(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    assert check(client, staff["other_engineer"], application_in_repair).status_code == 403
    assert check(client, staff["repairer"], application_in_repair).status_code == 403
    assert client.post(f"/engineer/{application_in_repair}/check", json={"passed": True}).status_code == 401
    assert check(client, staff["engineer"], 999).status_code == 404
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == Stage.REPAIRED


def test_failed_check_needs_comment(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    for comment in [None, "", "   "]:
        assert check(client, staff["engineer"], application_in_repair, passed=False, comment=comment).status_code == 422
    assert client.post(f"/engineer/{application_in_repair}/check", json={}, headers=staff["engineer"]).status_code == 422
    assert get_application(client, staff["repairer"], application_in_repair)["status_info"] == Stage.REPAIRED


def test_failed_check_goes_to_rediagnostics(client, staff, stock, application_in_repair):
    stock("Провода", 50, 10)
    client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода", "quantity": 2}, headers=staff["repairer"])
    repaired(client, staff, application_in_repair)

    r = check(client, staff["engineer"], application_in_repair, passed=False, comment="  не включается  ")
    assert r.status_code == 200
    data = r.json()
    assert data["status_info"] == Stage.CREATED and data["status"] == STATUS_CHECK_FAILED
    assert data["check_result"] == "не включается"
    assert data["assignee_engineer_id"] is None and data["assignee_repairer_id"] is None
    # уже поставленные запчасти остаются в заявке
    assert data["parts_cost"] == 100

    # заявку можно выдать только после нового круга
    assert client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"]).status_code == 400

    # повторную диагностику может взять любой инженер, ремонт - любой мастер
    take_and_diagnose(client, staff["other_engineer"], application_in_repair)
    assert client.post(f"/repairer/{application_in_repair}/takeRepair", headers=staff["other_repairer"]).status_code == 200
    r = client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода"}, headers=staff["other_repairer"])
    assert r.json()["parts_cost"] == 150
    assert client.post(f"/repairer/{application_in_repair}/repair", headers=staff["other_repairer"]).status_code == 200

    # проверяет уже инженер повторной диагностики
    assert check(client, staff["engineer"], application_in_repair).status_code == 403
    r = check(client, staff["other_engineer"], application_in_repair)
    assert r.status_code == 200 and r.json()["status_info"] == Stage.CHECKED
    assert client.post(f"/operator/{application_in_repair}/issue", headers=staff["operator"]).status_code == 200


def test_release_after_failed_check_keeps_failed_status(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    check(client, staff["engineer"], application_in_repair, passed=False, comment="шумит")

    r = client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["engineer"])
    assert r.json()["status"] == STATUS_DIAGNOSTICS_TAKEN
    r = client.post(f"/engineer/{application_in_repair}/release", headers=staff["engineer"])
    assert r.status_code == 200 and r.json()["status"] == STATUS_CHECK_FAILED

    client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["engineer"])
    r = client.post(f"/operator/{application_in_repair}/release", headers=staff["operator"])
    assert r.status_code == 200 and r.json()["status"] == STATUS_CHECK_FAILED


def test_operator_reassigns_check_to_other_engineer(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    # диагностировавший инженер еще держит заявку, другой взять не может
    assert client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["other_engineer"]).status_code == 400

    r = client.post(f"/operator/{application_in_repair}/release", headers=staff["operator"])
    assert r.status_code == 200 and r.json()["assignee_engineer_id"] is None and r.json()["status"] == STATUS_REPAIRED
    assert check(client, staff["engineer"], application_in_repair).status_code == 400

    r = client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["other_engineer"])
    assert r.status_code == 200 and r.json()["status"] == STATUS_REPAIRED
    assert check(client, staff["other_engineer"], application_in_repair).status_code == 200


def test_engineer_releases_check(client, staff, application_in_repair):
    repaired(client, staff, application_in_repair)
    r = client.post(f"/engineer/{application_in_repair}/release", headers=staff["engineer"])
    assert r.status_code == 200 and r.json()["assignee_engineer_id"] is None and r.json()["status"] == STATUS_REPAIRED
    assert client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["other_engineer"]).status_code == 200


def test_cannot_book_engineer_during_repair_or_after_check(client, staff, application_in_repair):
    client.post(f"/operator/{application_in_repair}/release", headers=staff["operator"])  # снимает мастера, не инженера
    assert client.post(f"/engineer/{application_in_repair}/takeEngineer", headers=staff["other_engineer"]).status_code == 400
    client.post(f"/repairer/{application_in_repair}/takeRepair", headers=staff["repairer"])
    repair_and_check(client, staff, application_in_repair)
    assert client.post(f"/engineer/{application_in_repair}/release", headers=staff["engineer"]).status_code == 400
