import json
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Rule, PipelineStage, Lead
from ..schemas import (
    RuleCreate, RuleUpdate, RuleOut, RuleCondition, EvaluateResult,
    PreviewResult, StageCount, KanbanLeadCard, PipelineStageOut,
)
from ..services.rule_engine import evaluate_all, preview_rule, evaluate_condition, _evaluate_node
from ..services.rule_engine import evaluate_rule as evaluate_rule_fn

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _parse_conditions(raw) -> tuple[str, list]:
    """Return (logic, items) from either old array format or new {logic,items} format."""
    if isinstance(raw, list):
        return "and", raw
    return raw.get("logic", "and"), raw.get("items", [])


def _serialize_rule(rule: Rule, db: Session, matched_count: int | None = None) -> RuleOut:
    raw = json.loads(rule.conditions)
    logic, conditions = _parse_conditions(raw)
    return RuleOut(
        id=rule.id,
        name=rule.name,
        target_stage_id=rule.target_stage_id,
        target_stage=PipelineStageOut.model_validate(rule.target_stage),
        conditions=conditions,
        logic=logic,
        matched_count=matched_count,
        priority=rule.priority,
        is_active=rule.is_active,
        created_at=rule.created_at,
    )


@router.get("", response_model=List[RuleOut])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).order_by(Rule.priority.desc(), Rule.id).all()
    if not rules:
        return []
    terminal_ids = {
        s.id for s in db.query(PipelineStage).filter(
            PipelineStage.name.in_(["Won", "Lost"])
        ).all()
    }
    leads = db.query(Lead).filter(Lead.stage_id.notin_(terminal_ids)).all()
    result = []
    for rule in rules:
        count = sum(1 for l in leads if evaluate_rule_fn(l, rule))
        result.append(_serialize_rule(rule, db, matched_count=count))
    return result


@router.post("", response_model=RuleOut)
def create_rule(body: RuleCreate, db: Session = Depends(get_db)):
    stage = db.query(PipelineStage).filter(PipelineStage.id == body.target_stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    rule = Rule(
        name=body.name,
        target_stage_id=body.target_stage_id,
        conditions=json.dumps({"logic": body.logic, "items": body.conditions}),
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
        raw = json.loads(rule.conditions)
        _, existing_items = _parse_conditions(raw)
        new_logic = body.logic if body.logic is not None else raw.get("logic", "and") if isinstance(raw, dict) else "and"
        rule.conditions = json.dumps({"logic": new_logic, "items": body.conditions})
    elif body.logic is not None:
        raw = json.loads(rule.conditions)
        logic, items = _parse_conditions(raw)
        rule.conditions = json.dumps({"logic": body.logic, "items": items})
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


class SummarizeRequest(BaseModel):
    blocks: List[Any]
    target_stage: str = ""


@router.post("/summarize")
def summarize_rule(body: SummarizeRequest):
    """Use LLM to generate an executive-friendly rule summary."""
    import os
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"bullets": None, "joins": [], "stage": ""}

    # Build a readable description of the blocks to pass to LLM
    def fmt_val(v):
        if isinstance(v, list):
            return ", ".join(str(x) for x in v) if v else "…"
        return str(v) if v else "…"

    def fmt_cond(c):
        op_map = {
            "eq": "=", "neq": "≠", "in": "=", "not_in": "≠",
            "contains": "contains", "not_contains": "doesn't contain",
            "gt": ">", "gte": "≥", "lt": "<", "lte": "≤",
            "after": "after", "before": "before",
        }
        return f"{c.get('field','')} {op_map.get(c.get('operator',''),'?')} {fmt_val(c.get('value'))}"

    # Build one description string per block
    block_descs = []
    for i, block in enumerate(body.blocks):
        conds = [fmt_cond(c) for c in (block.get("conditions") or []) if c.get("field")]
        if not conds:
            continue
        logic = (block.get("logic") or "and").upper()
        join = (block.get("_join") or "and").upper() if i > 0 else None
        desc = f" {logic} ".join(conds)
        block_descs.append({"join": join, "desc": desc, "index": i + 1})

    if not block_descs:
        return {"bullets": None, "joins": [], "stage": ""}

    stage = body.target_stage or "the next stage"
    n = len(block_descs)

    numbered = "\n".join(f"{b['index']}. {b['desc']}" for b in block_descs)

    prompt = (
        f"You are a CRM analyst writing for a sales executive. "
        f"Below are {n} lead qualification rule blocks. "
        f"Rewrite each block as a short, natural English phrase that a salesperson would understand — "
        f"no raw field names, no operators like 'is' or 'equals', no 'and' chains. "
        f"Use business language (e.g. 'senior decision-makers who requested a demo', 'highly engaged visitors with 5+ site visits'). "
        f"Each phrase must be under 12 words. "
        f"Return ONLY a JSON array of exactly {n} strings, one per block. Example: [\"phrase one\", \"phrase two\"]\n\n"
        f"Blocks:\n{numbered}"
    )

    try:
        import json as _json
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=300,
        )
        text = resp.choices[0].message.content.strip()
        start, end = text.find("["), text.rfind("]")
        phrases = _json.loads(text[start:end + 1]) if start != -1 else []
        return {"bullets": phrases, "joins": [b["join"] for b in block_descs], "stage": stage}
    except Exception:
        return {"bullets": None, "joins": [b["join"] for b in block_descs], "stage": stage}


# Must come BEFORE /{rule_id}/preview to avoid route collision
class LivePreviewRequest(BaseModel):
    conditions: List[Any]
    logic: str = "and"


@router.post("/preview-conditions", response_model=PreviewResult)
def preview_conditions_live(body: LivePreviewRequest, db: Session = Depends(get_db)):
    """Dry-run for unsaved conditions — powers the live match counter in the UI."""
    terminal_ids = {
        s.id for s in db.query(PipelineStage).filter(
            PipelineStage.name.in_(["Won", "Lost"])
        ).all()
    }
    leads = db.query(Lead).filter(Lead.stage_id.notin_(terminal_ids)).all()
    node = {"logic": body.logic, "items": body.conditions}
    matched = [l for l in leads if _evaluate_node(l, node)]
    return PreviewResult(
        matched_count=len(matched),
        sample_leads=[KanbanLeadCard.model_validate(l) for l in matched[:5]],
        by_stage=[],
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
