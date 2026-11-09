def test_create_and_list(client, stock, admin_headers):
    stock("Провода", 50, 100)
    stock("Экран", 3000, 2)

    r = client.get("/services/stock", headers=admin_headers)
    assert r.status_code == 200
    assert [p["name"] for p in r.json()] == ["Провода", "Экран"]


def test_search_by_part_of_name(client, stock, admin_headers):
    stock("Провода USB", 50, 10)
    stock("Экран", 3000, 2)

    r = client.get("/services/stock", params={"search": "провод"}, headers=admin_headers)
    assert [p["name"] for p in r.json()] == ["Провода USB"]


def test_duplicate_name_case_insensitive(client, stock, admin_headers):
    stock("Провода", 50, 10)
    r = client.post("/services/stock", json={"name": "  провода ", "price": 70, "quantity": 1}, headers=admin_headers)
    assert r.status_code == 400


def test_update_price_and_quantity(client, stock, admin_headers):
    part = stock("Провода", 50, 10)

    r = client.patch(f"/services/stock/{part['id']}", json={"price": 75}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["price"] == 75 and r.json()["quantity"] == 10

    r = client.patch(f"/services/stock/{part['id']}", json={"quantity": 40}, headers=admin_headers)
    assert r.json()["price"] == 75 and r.json()["quantity"] == 40


def test_update_validation(client, stock, admin_headers):
    part = stock("Провода", 50, 10)
    assert client.patch(f"/services/stock/{part['id']}", json={}, headers=admin_headers).status_code == 400
    assert client.patch(f"/services/stock/{part['id']}", json={"price": 0}, headers=admin_headers).status_code == 422
    assert client.patch(f"/services/stock/{part['id']}", json={"quantity": -1}, headers=admin_headers).status_code == 422
    assert client.patch("/services/stock/999", json={"price": 10}, headers=admin_headers).status_code == 404


def test_create_validation(client, admin_headers):
    assert client.post("/services/stock", json={"name": "X", "price": -1}, headers=admin_headers).status_code == 422
    assert client.post("/services/stock", json={"name": "", "price": 10}, headers=admin_headers).status_code == 422
    assert client.post("/services/stock", json={"name": "X", "price": 10, "quantity": -5}, headers=admin_headers).status_code == 422


def test_repairer_can_view_stock(client, staff, stock):
    stock("Провода", 50, 10)
    r = client.get("/repairer/stock", headers=staff["repairer"])
    assert r.status_code == 200 and r.json()[0]["name"] == "Провода"
    assert client.get("/repairer/stock", headers=staff["operator"]).status_code == 403
