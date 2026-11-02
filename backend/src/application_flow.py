from enum import Enum


class ApplicationSource(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"  # Источник старых заявок до введения этого поля неизвестен.


class DeliveryStatus(str, Enum):
    CREATED = "created"
    COURIER_DISPATCHED = "courier_dispatched"
    COURIER_PICKED_UP = "courier_picked_up"
    ARRIVED = "arrived"
