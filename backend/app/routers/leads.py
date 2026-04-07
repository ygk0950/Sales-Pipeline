import json
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
)
from ..services.csv_service import preview_csv, import_csv

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("/upload", response_model=CSVPreview)
async def upload_csv_preview(file: UploadFile = File(...)):
    content = await file.read()
    return preview_csv(content)


@router.post("/import", response_model=ImportResult)
async def import_csv_file(
    file: UploadFile = File(...),
    mql_id: str = Form(...),
    first_contact_date: Optional[str] = Form(None),
    landing_page_id: Optional[str] = Form(None),
    origin: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    mapping = ColumnMapping(
        mql_id=mql_id,
        first_contact_date=first_contact_date,
        landing_page_id=landing_page_id,
        origin=origin,
    )
    return import_csv(content, mapping, db)


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
