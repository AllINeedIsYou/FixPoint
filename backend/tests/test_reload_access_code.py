def test_reissued_code_replaces_old_code(client, admin_headers):
    employee = client.post(
        "/services/access-codes", json={"role": "operator", "FIO": "Оператор перевыпуска"}
    , headers=admin_headers).json()

    response = client.post("/services/reload-access-code", json={"id": employee["id"]}, headers=admin_headers)

    assert response.status_code == 200, response.text
    assert response.json()["FIO"] == "Оператор перевыпуска"
    new_code = response.json()["Code"]
    assert new_code != employee["code"]
    assert client.post("/auth/login", data={"username": new_code}).status_code == 200
    assert client.post("/auth/login", data={"username": employee["code"]}).status_code == 401


def test_reissue_missing_employee(client, admin_headers):
    assert client.post("/services/reload-access-code", json={"id": 999999}, headers=admin_headers).status_code == 404
