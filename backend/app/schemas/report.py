from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class ReportType(str, Enum):
    stock_snapshot = "estoque_atual"
    movements = "movimentacoes"
    expiry = "produtos_a_vencer"
    turnover = "giro_estoque"


class ReportFormat(str, Enum):
    pdf = "pdf"
    xlsx = "xlsx"


class ReportRequest(BaseModel):
    report_type: ReportType
    format: ReportFormat = ReportFormat.pdf
    date_from: date | None = None
    date_to: date | None = None
    expiry_window_days: int = Field(default=15, ge=1, le=365)


class ReportResponse(BaseModel):
    url: str
    filename: str
    expires_in_seconds: int
