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
    conditions: List[RuleCondition]
    priority: int = 0
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    target_stage_id: Optional[int] = None
    conditions: Optional[List[RuleCondition]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RuleOut(BaseModel):
    id: int
    name: str
    target_stage_id: int
    target_stage: PipelineStageOut
    conditions: List[RuleCondition]
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


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


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
