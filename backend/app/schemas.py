from __future__ import annotations
from datetime import datetime, date
from typing import Any, List, Optional
from pydantic import BaseModel


# ── Pipeline Stages ──────────────────────────────────────────────────────────

class PipelineStageOut(BaseModel):
    id: int
    name: str
    display_order: int

    model_config = {"from_attributes": True}


# ── Rules ────────────────────────────────────────────────────────────────────

class RuleCondition(BaseModel):
    field: str
    operator: str   # eq, neq, in, not_in, gt, lt, before, after
    value: Any


class RuleCreate(BaseModel):
    name: str
    target_stage_id: int
    conditions: List[Any]
    logic: str = "and"
    priority: int = 0
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    target_stage_id: Optional[int] = None
    conditions: Optional[List[Any]] = None
    logic: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RuleOut(BaseModel):
    id: int
    name: str
    target_stage_id: int
    target_stage: PipelineStageOut
    conditions: List[Any]
    logic: str = "and"
    matched_count: Optional[int] = None
    priority: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Stage History ─────────────────────────────────────────────────────────────

class StageHistoryOut(BaseModel):
    id: int
    from_stage: Optional[PipelineStageOut]
    to_stage: PipelineStageOut
    rule_id: Optional[int]
    rule_name: Optional[str]
    rule_conditions: Optional[List[RuleCondition]]
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Leads ─────────────────────────────────────────────────────────────────────

class LeadOut(BaseModel):
    id: int
    mql_id: str
    first_contact_date: Optional[date]
    landing_page_id: Optional[str]
    origin: Optional[str]
    extra_data: Optional[dict] = None
    stage_id: int
    stage: PipelineStageOut
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadDetailOut(LeadOut):
    history: List[StageHistoryOut]


class LeadStageUpdate(BaseModel):
    stage_id: int


class LeadListOut(BaseModel):
    items: List[LeadOut]
    total: int
    page: int
    per_page: int


# ── CSV Upload ────────────────────────────────────────────────────────────────

class CSVPreview(BaseModel):
    columns: List[str]
    rows: List[dict]


class ColumnMapping(BaseModel):
    mql_id: str
    first_contact_date: Optional[str] = None
    landing_page_id: Optional[str] = None
    origin: Optional[str] = None
    extra_columns: Optional[dict[str, str]] = None     # {csv_column: target_name}
    column_types: Optional[dict[str, str]] = None     # {csv_column: "text"|"number"|"date"|"boolean"}
    date_formats: Optional[dict[str, str]] = None     # {csv_column: strptime_format or "excel_serial"|"unix_ms"|"unix_s"}


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


# ── Parser + Data Quality ────────────────────────────────────────────────────

class ColumnMappingSuggestion(BaseModel):
    target_field: str
    target_label: str
    csv_column: Optional[str]
    confidence: float
    needs_review: bool
    is_standard: bool = True  # True for core Lead fields, False for extra/custom
    data_type: str = "text"   # text | number | date | boolean
    date_format: Optional[str] = None  # e.g. "%Y-%m-%d", "excel_serial", "unix_ms" — only for date columns


class AutoMapResult(BaseModel):
    suggestions: List[ColumnMappingSuggestion]
    unmapped_csv_columns: List[str]


class CSVPreviewWithMapping(BaseModel):
    columns: List[str]
    rows: List[dict]
    mapping_suggestions: List[ColumnMappingSuggestion]
    unmapped_csv_columns: List[str]


class ColumnIssue(BaseModel):
    column: str
    target_field: Optional[str]
    issue_type: str
    severity: str
    message: str
    detail: Optional[dict] = None


class DataQualityReport(BaseModel):
    total_rows: int
    issues: List[ColumnIssue]
    column_stats: dict
    summary: str
    can_proceed: bool


# ── Dashboard ─────────────────────────────────────────────────────────────────

class StageCount(BaseModel):
    stage_id: int
    stage_name: str
    count: int


class ConversionRate(BaseModel):
    from_stage: str
    to_stage: str
    from_count: int
    to_count: int
    rate: float


class OriginStat(BaseModel):
    origin: str
    total: int
    by_stage: List[StageCount]


class DashboardSummary(BaseModel):
    total_leads: int
    by_stage: List[StageCount]
    win_rate: float


# ── Kanban ────────────────────────────────────────────────────────────────────

class KanbanLeadCard(BaseModel):
    id: int
    mql_id: str
    origin: Optional[str]
    first_contact_date: Optional[date]

    model_config = {"from_attributes": True}


class KanbanColumn(BaseModel):
    stage: PipelineStageOut
    leads: List[KanbanLeadCard]
    total: int


class PipelineView(BaseModel):
    columns: List[KanbanColumn]


# ── Rule evaluation result ────────────────────────────────────────────────────

class EvaluateResult(BaseModel):
    leads_moved: int
    by_stage: List[StageCount]


class PreviewResult(BaseModel):
    matched_count: int
    sample_leads: List[KanbanLeadCard]
    by_stage: List[StageCount] = []
