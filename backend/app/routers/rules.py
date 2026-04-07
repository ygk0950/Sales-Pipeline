import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Rule, PipelineStage, Lead
from ..schemas import (
    RuleCreate, RuleUpdate, RuleOut, RuleCondition, EvaluateResult,
    PreviewResult, StageCount, KanbanLeadCard, PipelineStageOut,
)
from ..services.rule_engine import evaluate_all, preview_rule, evaluate_condition

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _serialize_rule(rule: Rule, db: Session) -> RuleOut:
    conditions = json.loads(rule.conditions)
    return RuleOut(
        id=rule.id,
        name=rule.name,
        target_stage_id=rule.target_stage_id,
        target_stage=PipelineStageOut.model_validate(rule.target_stage),
        conditions=conditions,
        priority=rule.priority,
        is_active=rule.is_active,
        created_at=rule.created_at,
    )


@router.get("", response_model=List[RuleOut])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).order_by(Rule.priority.desc(), Rule.id).all()
    return [_serialize_rule(r, db) for r in rules]


@router.post("", response_model=RuleOut)
def create_rule(body: RuleCreate, db: Session = Depends(get_db)):
    stage = db.query(PipelineStage).filter(PipelineStage.id == body.target_stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    rule = Rule(
        name=body.name,
        target_stage_id=body.target_stage_id,
        conditions=json.dumps([c.model_dump() for c in body.conditions]),
        priority=body.priority,
        is_active=body.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize_rule(rule, db)


@router.put("/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: int, body: RuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if body.name is not None:
        rule.name = body.name
    if body.target_stage_id is not None:
        rule.target_stage_id = body.target_stage_id
    if body.conditions is not None:
        rule.conditions = json.dumps([c.model_dump() for c in body.conditions])
    if body.priority is not None:
        rule.priority = body.priority
    if body.is_active is not None:
        rule.is_active = body.is_active

    db.commit()
    db.refresh(rule)
    return _serialize_rule(rule, db)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


@router.post("/evaluate", response_model=EvaluateResult)
def run_evaluation(db: Session = Depends(get_db)):
    moved = evaluate_all(db)
    stages = {s.id: s.name for s in db.query(PipelineStage).all()}
    by_stage = [
        StageCount(stage_id=sid, stage_name=stages.get(sid, "Unknown"), count=cnt)
        for sid, cnt in moved.items()
    ]
    return EvaluateResult(leads_moved=sum(moved.values()), by_stage=by_stage)


# Must come BEFORE /{rule_id}/preview to avoid route collision
class LivePreviewRequest(BaseModel):
    conditions: List[RuleCondition]


@router.post("/preview-conditions", response_model=PreviewResult)
def preview_conditions_live(body: LivePreviewRequest, db: Session = Depends(get_db)):
    """Dry-run for unsaved conditions — powers the live match counter in the UI."""
    terminal_ids = {
        s.id for s in db.query(PipelineStage).filter(
            PipelineStage.name.in_(["Won", "Lost"])
        ).all()
    }
    leads = db.query(Lead).filter(Lead.stage_id.notin_(terminal_ids)).all()
    matched = [
        l for l in leads
        if all(evaluate_condition(l, c) for c in body.conditions)
    ]
    return PreviewResult(
        matched_count=len(matched),
        sample_leads=[KanbanLeadCard.model_validate(l) for l in matched[:20]],
    )


@router.post("/{rule_id}/preview", response_model=PreviewResult)
def preview_rule_endpoint(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    total, leads = preview_rule(db, rule)
    return PreviewResult(
        matched_count=total,
        sample_leads=[KanbanLeadCard.model_validate(l) for l in leads],
    )
