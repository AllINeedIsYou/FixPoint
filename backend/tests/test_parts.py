from conftest import get_application, stock_quantity, take_and_diagnose


def add_part(client, headers, app_id, name, quantity=1):
    return client.post(f"/repairer/{app_id}/parts", json={"name": name, "quantity": quantity}, headers=headers)


def test_part_is_taken_from_stock_with_stock_price(client, staff, stock, application_in_repair):
    stock("Провода", 50, 100)

    r = add_part(client, staff["repairer"], application_in_repair, "провода", 5)
    assert r.status_code == 200, r.text
    part = r.json()["parts"][0]
    assert part["name"] == "Провода" and part["price"] == 50 and part["quantity"] == 5
    assert r.json()["parts_cost"] == 250
    assert stock_quantity(client, "Провода") == 95


def test_part_not_in_stock(client, staff, application_in_repair):
    r = add_part(client, staff["repairer"], application_in_repair, "Несуществующая деталь")
    assert r.status_code == 404


def test_not_enough_in_stock(client, staff, stock, application_in_repair):
    stock("Экран", 3000, 2)
    r = add_part(client, staff["repairer"], application_in_repair, "Экран", 3)
    assert r.status_code == 400
    assert stock_quantity(client, "Экран") == 2


def test_stock_price_change_does_not_change_added_parts(client, staff, stock, application_in_repair):
    part = stock("Провода", 50, 100)
    add_part(client, staff["repairer"], application_in_repair, "Провода", 2)

    client.patch(f"/services/stock/{part['id']}", json={"price": 999})

    assert get_application(client, staff["repairer"], application_in_repair)["parts_cost"] == 100


def test_delete_part_returns_it_to_stock(client, staff, stock, application_in_repair):
    stock("Провода", 50, 100)
    part_id = add_part(client, staff["repairer"], application_in_repair, "Провода", 5).json()["parts"][0]["id"]

    r = client.delete(f"/repairer/{application_in_repair}/parts/{part_id}", headers=staff["repairer"])
    assert r.status_code == 200 and r.json()["parts"] == []
    assert stock_quantity(client, "Провода") == 100

    r = client.delete(f"/repairer/{application_in_repair}/parts/{part_id}", headers=staff["repairer"])
    assert r.status_code == 404


def test_validation(client, staff, application_in_repair):
    assert add_part(client, staff["repairer"], application_in_repair, "Провода", 0).status_code == 422
    assert add_part(client, staff["repairer"], application_in_repair, "").status_code == 422


# --- доступ к запчастям в зависимости от статуса заявки ---

def test_cannot_add_parts_before_diagnostics(client, staff, stock, new_application):
    stock("Провода", 50, 100)
    app_id = new_application()
    client.post(f"/repairer/{app_id}/takeRepair", headers=staff["repairer"])
    r = add_part(client, staff["repairer"], app_id, "Провода")
    assert r.status_code == 400 and "диагностики" in r.json()["detail"]
    assert stock_quantity(client, "Провода") == 100


def test_cannot_add_parts_if_not_taken(client, staff, stock, new_application):
    stock("Провода", 50, 100)
    app_id = new_application()
    take_and_diagnose(client, staff["engineer"], app_id)
    assert add_part(client, staff["repairer"], app_id, "Провода").status_code == 400


def test_other_repairer_cannot_touch_parts(client, staff, stock, application_in_repair):
    stock("Провода", 50, 100)
    part_id = add_part(client, staff["repairer"], application_in_repair, "Провода").json()["parts"][0]["id"]

    assert add_part(client, staff["other_repairer"], application_in_repair, "Провода").status_code == 403
    r = client.delete(f"/repairer/{application_in_repair}/parts/{part_id}", headers=staff["other_repairer"])
    assert r.status_code == 403


def test_cannot_change_parts_after_repair(client, staff, stock, application_in_repair):
    stock("Провода", 50, 100)
    part_id = add_part(client, staff["repairer"], application_in_repair, "Провода").json()["parts"][0]["id"]
    assert client.post(f"/repairer/{application_in_repair}/repair", headers=staff["repairer"]).status_code == 200

    assert add_part(client, staff["repairer"], application_in_repair, "Провода").status_code == 400
    r = client.delete(f"/repairer/{application_in_repair}/parts/{part_id}", headers=staff["repairer"])
    assert r.status_code == 400


def test_only_repairer_role(client, staff, application_in_repair):
    assert add_part(client, staff["operator"], application_in_repair, "Провода").status_code == 403
    assert client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода"}).status_code == 401
