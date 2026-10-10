import json

import pytest
from sqlalchemy.exc import DataError

from src.shemas import MAX_PRICE, MAX_QUANTITY

APPLICATION = {"FIO": "Иван", "number": "+79161234567", "email": "ivan@example.com", "info": "не включается"}

# \x00 и одиночный суррогат Postgres не сохраняет (раньше это давало 500), суррогат шлем \ud800-эскейпом как настоящий клиент
BAD_STRINGS = ["a\x00b", "\ud800"]


def post_raw(client, url, body, headers=None):
    return client.post(url, content=json.dumps(body), headers={"Content-Type": "application/json", **(headers or {})})


@pytest.mark.parametrize("bad", BAD_STRINGS)
def test_bad_strings_in_body(client, staff, stock, new_application, bad):
    stock("Провода", 50, 10)
    assert post_raw(client, "/operator/add_application", {**APPLICATION, "FIO": bad}, staff["operator"]).status_code == 422
    assert post_raw(client, "/operator/add_application", {**APPLICATION, "info": bad}, staff["operator"]).status_code == 422
    assert post_raw(client, "/services/access-codes", {"role": "repairer", "FIO": bad}).status_code == 422
    assert post_raw(client, "/services/stock", {"name": bad, "price": 10}).status_code == 422

    app_id = new_application()
    client.post(f"/engineer/{app_id}/takeEngineer", headers=staff["engineer"])
    assert post_raw(client, f"/engineer/{app_id}/diagnose", {"diagnostic_info": bad}, staff["engineer"]).status_code == 422


@pytest.mark.parametrize("bad", BAD_STRINGS)
def test_bad_strings_in_unconstrained_fields(client, staff, bad):
    # 422 повторяет присланное значение, с суррогатом его кодирование раньше падало в 500
    r = post_raw(client, "/operator/add_application", {**APPLICATION, "email": bad}, staff["operator"])
    assert r.status_code == 422 and r.json()["detail"]
    assert post_raw(client, "/operator/add_application", {**APPLICATION, "number": bad}, staff["operator"]).status_code == 422
    assert post_raw(client, "/services/access-codes", {"role": bad, "FIO": "Мастер"}).status_code == 400


def test_bad_strings_in_query(client, staff):
    assert client.get("/services/stock?search=a%00b").status_code == 422
    assert client.get("/repairer/stock?search=%00", headers=staff["repairer"]).status_code == 422
    # битый utf-8 в URL starlette сам заменяет на �, суррогат до БД не доходит
    assert client.get("/repairer/stock?search=%ED%A0%80", headers=staff["repairer"]).status_code == 200


def test_fio_length(client, staff):
    assert client.post("/operator/add_application", json={**APPLICATION, "FIO": "Я" * 256}, headers=staff["operator"]).status_code == 422
    assert client.post("/operator/add_application", json={**APPLICATION, "FIO": "Я" * 255}, headers=staff["operator"]).status_code == 200
    assert client.post("/services/access-codes", json={"role": "repairer", "FIO": "Я" * 256}).status_code == 422


@pytest.mark.parametrize("price", [0.001, 0.004, MAX_PRICE + 0.005, 10 ** 12])
def test_price_out_of_db_range(client, stock, price):
    part = stock("Провода", 50, 10)
    assert client.post("/services/stock", json={"name": "Экран", "price": price}).status_code == 422
    assert client.patch(f"/services/stock/{part['id']}", json={"price": price}).status_code == 422


def test_price_bounds_ok(client, stock):
    assert stock("Дешевая", 0.01, 1)["price"] == 0.01
    assert stock("Дорогая", MAX_PRICE, 1)["price"] == MAX_PRICE


def test_quantity_out_of_db_range(client, staff, stock, application_in_repair):
    part = stock("Провода", 50, MAX_QUANTITY)
    too_many = MAX_QUANTITY + 1
    assert client.post("/services/stock", json={"name": "Экран", "price": 10, "quantity": too_many}).status_code == 422
    assert client.patch(f"/services/stock/{part['id']}", json={"quantity": too_many}).status_code == 422
    r = client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода", "quantity": too_many}, headers=staff["repairer"])
    assert r.status_code == 422


def test_stock_name_is_stripped(client):
    r = client.post("/services/stock", json={"name": "  Провода  ", "price": 10})
    assert r.status_code == 200 and r.json()["name"] == "Провода"
    assert client.post("/services/stock", json={"name": "   ", "price": 10}).status_code == 422


def test_data_error_is_400_not_500(client, monkeypatch):
    # страховка в main.py: если значение все же не влезло в колонку БД, клиент получает 400
    def broken(**kwargs):
        raise DataError("INSERT ...", {}, Exception("value too long"))
    monkeypatch.setattr("src.api.roles.admin.get_stock", broken)
    r = client.get("/services/stock")
    assert r.status_code == 400 and "не помещается" in r.json()["detail"]


def test_infinite_number(client, stock):
    # 1e309 в json парсится в inf, ответ 422 с ним раньше не сериализовался и давал 500
    part = stock("Провода", 50, 10)
    r = client.post("/services/stock", content='{"name": "Кабель", "price": 1e309}', headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["detail"]
    r = client.patch(f"/services/stock/{part['id']}", content='{"price": 1e309}', headers={"Content-Type": "application/json"})
    assert r.status_code == 422
