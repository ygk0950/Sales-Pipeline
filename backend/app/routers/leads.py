import json
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Lead, PipelineStage, StageHistory
from ..schemas import (
    LeadOut, LeadDetailOut, LeadListOut, LeadStageUpdate,
    StageHistoryOut, PipelineStageOut,
    CSVPreview, ColumnMapping, ImportResult,
    CSVPreviewWithMapping, DataQualityReport,
)
from ..services.csv_service import preview_csv, import_csv
from ..services.mapping_service import auto_map_columns
from ..services.dq_service import analyze_data_quality
from ..services.rule_engine import flush_stage

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _parse_mapping(
    mql_id: str,
    first_contact_date: Optional[str],
    landing_page_id: Optional[str],
    origin: Optional[str],
    extra_columns: Optional[str],
    column_types: Optional[str],
    date_formats: Optional[str],
) -> ColumnMapping:
    """Build a ColumnMapping from form fields."""
    return ColumnMapping(
        mql_id=mql_id,
        first_contact_date=first_contact_date,
        landing_page_id=landing_page_id,
        origin=origin,
        extra_columns=json.loads(extra_columns) if extra_columns else None,
        column_types=json.loads(column_types) if column_types else None,
        date_formats=json.loads(date_formats) if date_formats else None,
    )


@router.post("/upload", response_model=CSVPreviewWithMapping)
async def upload_csv_preview(file: UploadFile = File(...)):
    content = await file.read()
    preview = preview_csv(content)
    map_result = auto_map_columns(preview.columns, sample_rows=preview.rows)
    return CSVPreviewWithMapping(
        columns=preview.columns,
        rows=preview.rows,
        mapping_suggestions=map_result.suggestions,
        unmapped_csv_columns=map_result.unmapped_csv_columns,
    )


@router.post("/import", response_model=ImportResult)
async def import_csv_file(
    file: UploadFile = File(...),
    mql_id: str = Form(...),
    first_contact_date: Optional[str] = Form(None),
    landing_page_id: Optional[str] = Form(None),
    origin: Optional[str] = Form(None),
    extra_columns: Optional[str] = Form(None),
    column_types: Optional[str] = Form(None),
    date_formats: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    mapping = _parse_mapping(mql_id, first_contact_date, landing_page_id, origin, extra_columns, column_types, date_formats)
    return import_csv(content, mapping, db)


@router.post("/analyze", response_model=DataQualityReport)
async def analyze_csv(
    file: UploadFile = File(...),
    mql_id: str = Form(...),
    first_contact_date: Optional[str] = Form(None),
    landing_page_id: Optional[str] = Form(None),
    origin: Optional[str] = Form(None),
    extra_columns: Optional[str] = Form(None),
    column_types: Optional[str] = Form(None),
    date_formats: Optional[str] = Form(None),
):
    content = await file.read()
    mapping = _parse_mapping(mql_id, first_contact_date, landing_page_id, origin, extra_columns, column_types, date_formats)
    return analyze_data_quality(content, mapping)


@router.get("/fields")
def get_available_fields(db: Session = Depends(get_db)):
    """Return all available fields for rule building with distinct values."""
    import re as _re

    def _to_readable(key: str) -> str:
        return _re.sub(r"[_\-\.]+", " ", key).title()

    def _is_number_val(s: str) -> bool:
        try:
            float(s.replace(",", ""))
            return True
        except ValueError:
            return False

    def _infer_type(key: str, samples: list) -> str:
        # Numeric check first — beats keyword guessing
        if samples and all(_is_number_val(s) for s in samples):
            return "number"
        bool_vals = {"yes", "no", "true", "false", "1", "0", "y", "n"}
        if samples and all(s.strip().lower() in bool_vals for s in samples):
            return "boolean"
        # Date only when key clearly signals a calendar date, not duration/count
        if any(key.lower().endswith(w) for w in ["_date", "_at", "date"]) or \
           any(w in key.lower() for w in ["first_contact", "created", "updated"]):
            return "date"
        return "text"

    # Origin options with counts
    origin_rows = (
        db.query(Lead.origin, func.count(Lead.id))
        .group_by(Lead.origin)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    origin_options = [{"value": v or "(unknown)", "count": c} for v, c in origin_rows]

    standard = [
        {"value": "mql_id", "label": "Lead ID", "type": "text", "options": None},
        {"value": "first_contact_date", "label": "First Contact Date", "type": "date", "options": None},
        {"value": "landing_page_id", "label": "Landing Page", "type": "text", "options": None},
        {"value": "origin", "label": "Channel", "type": "enum", "options": origin_options},
    ]

    # Collect ALL extra_data keys + value counts
    all_extra = db.query(Lead.extra_data).filter(Lead.extra_data.isnot(None)).all()
    counters: dict[str, Counter] = {}
    type_samples: dict[str, list] = {}

    for (extra_data,) in all_extra:
        if isinstance(extra_data, dict):
            for key, value in extra_data.items():
                if key not in counters:
                    counters[key] = Counter()
                    type_samples[key] = []
                if value:
                    s = str(value)
                    counters[key][s] += 1
                    if len(type_samples[key]) < 5:
                        type_samples[key].append(s)

    extra_fields = []
    for key, counter in counters.items():
        data_type = _infer_type(key, type_samples[key])
        options = (
            [{"value": v, "count": c} for v, c in counter.most_common()]
            if len(counter) <= 100 else None
        )
        extra_fields.append({
            "value": key,
            "label": _to_readable(key),
            "type": data_type,
            "options": options,
        })

    return standard + extra_fields


@router.post("/flush-stage")
def flush_stage_leads(stage_id: int, db: Session = Depends(get_db)):
    count = flush_stage(db, stage_id)
    return {"flushed": count}


@router.delete("/all")
def delete_all_leads(db: Session = Depends(get_db)):
    count = db.query(Lead).count()
    db.query(StageHistory).delete()
    db.query(Lead).delete()
    db.commit()
    return {"deleted": count}


@router.get("", response_model=LeadListOut)
def list_leads(
    stage_id: Optional[int] = None,
    origin: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Lead)
    if stage_id:
        query = query.filter(Lead.stage_id == stage_id)
    if origin:
        query = query.filter(Lead.origin == origin)
    if search:
        query = query.filter(Lead.mql_id.contains(search))

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return LeadListOut(items=items, total=total, page=page, per_page=per_page)


@router.get("/{lead_id}", response_model=LeadDetailOut)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    history_out = []
    for h in lead.history:
        rule_name = None
        rule_conditions = None
        if h.rule:
            rule_name = h.rule.name
            try:
                rule_conditions = json.loads(h.rule.conditions)
            except Exception:
                rule_conditions = []
        history_out.append(StageHistoryOut(
            id=h.id,
            from_stage=PipelineStageOut.model_validate(h.from_stage) if h.from_stage else None,
            to_stage=PipelineStageOut.model_validate(h.to_stage),
            rule_id=h.rule_id,
            rule_name=rule_name,
            rule_conditions=rule_conditions,
            changed_at=h.changed_at,
        ))

    return LeadDetailOut(
        id=lead.id,
        mql_id=lead.mql_id,
        first_contact_date=lead.first_contact_date,
        landing_page_id=lead.landing_page_id,
        origin=lead.origin,
        extra_data=lead.extra_data,
        stage_id=lead.stage_id,
        stage=PipelineStageOut.model_validate(lead.stage),
        created_at=lead.created_at,
        history=history_out,
    )


@router.patch("/{lead_id}/stage", response_model=LeadOut)
def update_lead_stage(
    lead_id: int,
    body: LeadStageUpdate,
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    stage = db.query(PipelineStage).filter(PipelineStage.id == body.stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    history_entry = StageHistory(
        lead_id=lead.id,
        from_stage_id=lead.stage_id,
        to_stage_id=body.stage_id,
        rule_id=None,
    )
    db.add(history_entry)
    lead.stage_id = body.stage_id
    db.commit()
    db.refresh(lead)
    return lead
