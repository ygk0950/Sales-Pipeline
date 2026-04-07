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
    return getattr(lead, field, None)


def _parse_date(value) -> Optional[date]:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"]:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
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
    return False


def evaluate_rule(lead: Lead, rule: Rule) -> bool:
    try:
        conditions = [RuleCondition(**c) for c in json.loads(rule.conditions)]
    except Exception:
        return False
    return all(evaluate_condition(lead, c) for c in conditions)


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
