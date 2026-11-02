def test_reissued_code_replaces_old_code(client):
    employee = client.post(
        "/services/access-codes", json={"role": "operator", "FIO": "Оператор перевыпуска"}
    ).json()

    response = client.post("/services/reload-access-code", json={"id": employee["id"]})

    assert response.status_code == 200, response.text
    assert response.json()["FIO"] == "Оператор перевыпуска"
    new_code = response.json()["Code"]
    assert new_code != employee["code"]
    assert client.post("/auth/login", data={"username": new_code}).status_code == 200
    assert client.post("/auth/login", data={"username": employee["code"]}).status_code == 401


def test_reissue_missing_employee(client):
    assert client.post("/services/reload-access-code", json={"id": 999999}).status_code == 404
