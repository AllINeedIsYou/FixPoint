import pytest

from .conftest import get_application
from src.models import WORK_COST, Application, Client, Part


@pytest.mark.parametrize("source,expected", [("online", 6000), ("offline", 5000), ("unknown", 5000)])
def test_cost_without_parts_is_work_only(source, expected):
    application = Application(client=Client(FIO="Иван", number="+79161234567", email="i@example.com"), info="x", source=source)
    assert application.parts_cost == 0
    assert application.work_cost == expected
    assert application.total_cost == expected


@pytest.mark.parametrize("source,expected", [("online", 6000), ("offline", 5000), ("unknown", 5000)])
def test_cost_sums_parts_with_quantity_plus_work(source, expected):
    application = Application(client=Client(FIO="Иван", number="+79161234567", email="i@example.com"), info="x", source=source)
    application.parts = [Part(name="Экран", price=3000, quantity=1), Part(name="Провода", price=50, quantity=5)]
    assert application.parts_cost == 3250
    assert application.total_cost == 3250 + expected


def test_cost_in_api(client, staff, stock, application_in_repair):
    stock("Экран", 3000, 5)
    stock("Провода", 12.35, 100)
    client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Экран"}, headers=staff["repairer"])
    client.post(f"/repairer/{application_in_repair}/parts", json={"name": "Провода", "quantity": 3}, headers=staff["repairer"])

    application = get_application(client, staff["repairer"], application_in_repair)
    assert application["parts_cost"] == pytest.approx(3037.05)
    assert application["work_cost"] == WORK_COST
    assert application["total_cost"] == pytest.approx(3037.05 + WORK_COST)
