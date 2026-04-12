import json
from datetime import datetime, date
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models import Lead, Rule, PipelineStage, StageHistory
from ..schemas import RuleCondition


PIPELINE_ORDER = ["New", "MQL", "SQL", "Opportunity", "Won", "Lost"]
# Stages a lead can advance to via rules (not Won/Lost automatically)
ADVANCEABLE = ["MQL", "SQL", "Opportunity"]


def _get_lead_field(lead: Lead, field: str):
    val = getattr(lead, field, None)
    if val is not None:
        return val
    # Fall back to extra_data JSON for custom fields
    if lead.extra_data and field in lead.extra_data:
        return lead.extra_data[field]
    return None


def _parse_date(value) -> Optional[date]:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        try:
            from dateutil.parser import parse as dateutil_parse
            return dateutil_parse(value.strip(), dayfirst=False).date()
        except Exception:
            pass
    return None


def evaluate_condition(lead: Lead, cond: RuleCondition) -> bool:
    field_val = _get_lead_field(lead, cond.field)
    rule_val = cond.value
    op = cond.operator

    # Normalize empty strings
    if isinstance(field_val, str) and field_val.strip() == "":
        field_val = None

    if op == "eq":
        return str(field_val) == str(rule_val) if field_val is not None else False
    elif op == "neq":
        return str(field_val) != str(rule_val)
    elif op == "in":
        if field_val is None:
            return None in rule_val or "" in rule_val
        return str(field_val) in [str(v) for v in rule_val]
    elif op == "not_in":
        if field_val is None:
            return None not in rule_val and "" not in rule_val
        return str(field_val) not in [str(v) for v in rule_val]
    elif op == "gt":
        return field_val is not None and field_val > rule_val
    elif op == "lt":
        return field_val is not None and field_val < rule_val
    elif op == "gte":
        return field_val is not None and field_val >= rule_val
    elif op == "lte":
        return field_val is not None and field_val <= rule_val
    elif op == "after":
        if field_val is None:
            return False
        rv = _parse_date(rule_val)
        fv = field_val if isinstance(field_val, date) else _parse_date(str(field_val))
        return fv is not None and rv is not None and fv > rv
    elif op == "before":
        if field_val is None:
            return False
        rv = _parse_date(rule_val)
        fv = field_val if isinstance(field_val, date) else _parse_date(str(field_val))
        return fv is not None and rv is not None and fv < rv
    elif op == "contains":
        if field_val is None:
            return False
        return str(rule_val).lower() in str(field_val).lower()
    elif op == "not_contains":
        if field_val is None:
            return True
        return str(rule_val).lower() not in str(field_val).lower()
    return False


_SKIP_KEYS = {"_join"}


def _eval_single(lead: Lead, item: dict) -> bool:
    if "field" in item:
        return evaluate_condition(lead, RuleCondition(**{k: v for k, v in item.items() if k not in _SKIP_KEYS}))
    if "conditions" in item:
        return _evaluate_block(lead, item)
    return True


def _evaluate_block(lead: Lead, block: dict) -> bool:
    """Evaluate conditions within a block using block-level logic."""
    conditions = block.get("conditions", [])
    if not conditions:
        return True
    logic = block.get("logic", "and")
    results = [_eval_single(lead, c) for c in conditions]
    return any(results) if logic == "or" else all(results)


def _evaluate_node(lead: Lead, node) -> bool:
    """Evaluate a rule node — supports blocks format, legacy list, and legacy dict."""
    if isinstance(node, list):
        if not node:
            return True
        # Blocks format: list of {_join, conditions:[...]}
        if isinstance(node[0], dict) and "conditions" in node[0]:
            result = _evaluate_block(lead, node[0])
            for block in node[1:]:
                join = block.get("_join", "and")
                val = _evaluate_block(lead, block)
                result = (result or val) if join == "or" else (result and val)
            return result
        # Legacy flat list with per-condition _join
        result = _eval_single(lead, node[0])
        for item in node[1:]:
            join = item.get("_join", "and")
            val = _eval_single(lead, item)
            result = (result or val) if join == "or" else (result and val)
        return result

    if isinstance(node, dict) and "items" in node:
        # Legacy {logic, items} format
        items = node.get("items", [])
        if not items:
            return True
        default_join = node.get("logic", "and")
        result = _eval_single(lead, items[0])
        for item in items[1:]:
            join = item.get("_join", default_join)
            val = _eval_single(lead, item)
            result = (result or val) if join == "or" else (result and val)
        return result

    if isinstance(node, dict) and "field" in node:
        return _eval_single(lead, node)

    return True


def evaluate_rule(lead: Lead, rule: Rule) -> bool:
    try:
        return _evaluate_node(lead, json.loads(rule.conditions))
    except Exception:
        return False


def evaluate_all(db: Session) -> dict:
    """Run all active rules against all leads. Returns count moved per stage."""
    stages = {s.name: s for s in db.query(PipelineStage).all()}
    stage_order = {name: i for i, name in enumerate(PIPELINE_ORDER)}

    rules = (
        db.query(Rule)
        .filter(Rule.is_active == True)
        .order_by(Rule.priority.desc())
        .all()
    )

    # Group rules by target stage
    rules_by_stage: dict[int, list[Rule]] = {}
    for r in rules:
        rules_by_stage.setdefault(r.target_stage_id, []).append(r)

    # Get advanceable stage objects in pipeline order
    advanceable_stages = [
        stages[name] for name in ADVANCEABLE if name in stages
    ]

    # Load leads that are not yet Won or Lost
    terminal_ids = {stages[n].id for n in ["Won", "Lost"] if n in stages}
    leads = db.query(Lead).filter(Lead.stage_id.notin_(terminal_ids)).all()

    moved_counts: dict[int, int] = {}

    for lead in leads:
        current_order = stage_order.get(lead.stage.name if lead.stage else "New", 0)

        for target_stage in advanceable_stages:
            # Only try to advance forward
            if stage_order.get(target_stage.name, 0) <= current_order:
                continue

            # Check if any rule for this stage matches
            matching_rule = None
            for rule in rules_by_stage.get(target_stage.id, []):
                if evaluate_rule(lead, rule):
                    matching_rule = rule
                    break

            if matching_rule:
                # Record history
                history_entry = StageHistory(
                    lead_id=lead.id,
                    from_stage_id=lead.stage_id,
                    to_stage_id=target_stage.id,
                    rule_id=matching_rule.id,
                )
                db.add(history_entry)

                # Advance lead
                lead.stage_id = target_stage.id
                lead.qualified_at = datetime.utcnow()
                current_order = stage_order.get(target_stage.name, current_order)
                moved_counts[target_stage.id] = moved_counts.get(target_stage.id, 0) + 1
            else:
                # Stop at first stage where no rule matches
                break

    db.commit()
    return moved_counts


def evaluate_for_stage(db: Session, target_stage_id: int) -> dict:
    """Run rules for a single target stage only — moves leads from the immediately preceding stage."""
    stages = {s.name: s for s in db.query(PipelineStage).all()}
    stages_by_id = {s.id: s for s in stages.values()}

    target_stage = stages_by_id.get(target_stage_id)
    if not target_stage or target_stage.name not in ADVANCEABLE:
        return {}

    # Find the stage immediately before the target in pipeline order
    idx = PIPELINE_ORDER.index(target_stage.name)
    source_stage_name = PIPELINE_ORDER[idx - 1]
    source_stage = stages.get(source_stage_name)
    if not source_stage:
        return {}

    # Rules targeting this stage, sorted by priority
    rules = (
        db.query(Rule)
        .filter(Rule.target_stage_id == target_stage_id, Rule.is_active == True)
        .order_by(Rule.priority.desc())
        .all()
    )
    if not rules:
        return {}

    # Only leads currently in the source stage
    leads = db.query(Lead).filter(Lead.stage_id == source_stage.id).all()

    moved = 0
    for lead in leads:
        for rule in rules:
            if evaluate_rule(lead, rule):
                db.add(StageHistory(
                    lead_id=lead.id,
                    from_stage_id=source_stage.id,
                    to_stage_id=target_stage_id,
                    rule_id=rule.id,
                ))
                lead.stage_id = target_stage_id
                lead.qualified_at = datetime.utcnow()
                moved += 1
                break

    db.commit()
    return {target_stage_id: moved}


def flush_stage(db: Session, stage_id: int) -> int:
    """Move all leads in stage_id back to the immediately preceding stage."""
    stages = {s.name: s for s in db.query(PipelineStage).all()}
    stages_by_id = {s.id: s for s in stages.values()}

    stage = stages_by_id.get(stage_id)
    if not stage or stage.name not in PIPELINE_ORDER:
        return 0

    idx = PIPELINE_ORDER.index(stage.name)
    if idx == 0:
        return 0  # Already at the first stage, nothing to flush back to

    prev_stage = stages.get(PIPELINE_ORDER[idx - 1])
    if not prev_stage:
        return 0

    leads = db.query(Lead).filter(Lead.stage_id == stage_id).all()
    for lead in leads:
        db.add(StageHistory(
            lead_id=lead.id,
            from_stage_id=stage_id,
            to_stage_id=prev_stage.id,
            rule_id=None,
        ))
        lead.stage_id = prev_stage.id

    db.commit()
    return len(leads)


def preview_rule(db: Session, rule: Rule, limit: int = 20) -> tuple[int, list[Lead]]:
    """Dry-run: return leads that would match this rule."""
    terminal_ids = {
        s.id for s in db.query(PipelineStage).filter(
            PipelineStage.name.in_(["Won", "Lost"])
        ).all()
    }
    leads = db.query(Lead).filter(Lead.stage_id.notin_(terminal_ids)).all()
    matched = [lead for lead in leads if evaluate_rule(lead, rule)]
    return len(matched), matched[:limit]
