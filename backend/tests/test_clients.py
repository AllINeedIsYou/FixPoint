import pytest


@pytest.fixture
def add(client, staff):
    def make(FIO="Иван Петров", number="+79161234567", email="ivan@example.com", info="не включается"):
        return client.post(
            "/operator/add_application",
            json={"FIO": FIO, "number": number, "email": email, "info": info},
            headers=staff["operator"],
        )
    return make


def clients(client, staff, **params):
    r = client.get("/operator/clients", params=params, headers=staff["operator"])
    assert r.status_code == 200, r.text
    return r.json()


def test_same_client_for_repeat_visits(client, staff, add):
    first, second = add().json(), add(info="разбит экран").json()
    assert first["client_id"] == second["client_id"]

    [c] = clients(client, staff)
    assert c["FIO"] == "Иван Петров" and c["application_ids"] == [first["id"], second["id"]]

    r = client.get(f"/operator/clients/{c['id']}/applications", headers=staff["operator"])
    assert [a["info"] for a in r.json()] == ["не включается", "разбит экран"]
    assert all(a["FIO"] == "Иван Петров" and a["email"] == "ivan@example.com" for a in r.json())


def test_phone_formats_are_one_client(client, staff, add):
    a = add(number="+79161234567").json()
    b = add(number="+7 (916) 123-45-67").json()
    assert a["client_id"] == b["client_id"]
    assert len(clients(client, staff)) == 1


def test_case_and_spaces_do_not_matter(client, staff, add):
    add()
    r = add(FIO="  иван петров ", email="IVAN@example.com")
    assert r.status_code == 200
    assert clients(client, staff)[0]["FIO"] == "Иван Петров"


@pytest.mark.parametrize("changed", [{"FIO": "Пётр Иванов"}, {"email": "other@example.com"}])
def test_same_phone_other_person_is_400(client, staff, add, changed):
    add()
    r = add(**changed)
    assert r.status_code == 400
    assert "Иван Петров" in r.json()["detail"] and "ivan@example.com" in r.json()["detail"]
    [c] = clients(client, staff)
    assert len(c["application_ids"]) == 1


def test_different_phones_are_different_clients(client, staff, add):
    add()
    add(number="+79991112233")
    assert len(clients(client, staff)) == 2


def test_search(client, staff, add):
    add()
    add(FIO="Мария Сидорова", number="+79991112233", email="m@example.com")
    assert [c["FIO"] for c in clients(client, staff, search="сидор")] == ["Мария Сидорова"]
    assert [c["FIO"] for c in clients(client, staff, search="1112233")] == ["Мария Сидорова"]
    assert clients(client, staff, search="%") == []


def test_deleting_application_keeps_client(client, staff, add):
    app_id = add().json()["id"]
    client.delete(f"/operator/delete_applications/{app_id}", headers=staff["operator"])
    [c] = clients(client, staff)
    assert c["application_ids"] == []
    assert add().json()["client_id"] == c["id"]


def test_client_status_uses_client_name(client, add):
    app_id = add().json()["id"]
    assert "Иван Петров" in client.get("/client/status", params={"application_id": app_id}).json()


def test_access(client, staff, add):
    add()
    assert client.get("/operator/clients", headers=staff["repairer"]).status_code == 403
    assert client.get("/operator/clients").status_code == 401
    assert client.get("/operator/clients/999/applications", headers=staff["operator"]).status_code == 404
