"""Schemas de domínio do MS Warehouse."""

from ms_warehouse.schemas.movement import MovementCreate, MovementResult
from ms_warehouse.schemas.report import (
    ReportFormat,
    ReportRequest,
    ReportResponse,
    ReportType,
)
from ms_warehouse.schemas.warehouse import (
    DispatchItemRequest,
    InternalDispatchRequest,
    InternalReleaseRequest,
    ProductAvailabilityOut,
    ProductsBatchRequest,
)

__all__ = [
    "DispatchItemRequest",
    "InternalDispatchRequest",
    "InternalReleaseRequest",
    "MovementCreate",
    "MovementResult",
    "ProductAvailabilityOut",
    "ProductsBatchRequest",
    "ReportFormat",
    "ReportRequest",
    "ReportResponse",
    "ReportType",
]
