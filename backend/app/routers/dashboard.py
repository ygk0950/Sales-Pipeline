from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Lead, PipelineStage, StageHistory
from ..schemas import DashboardSummary, StageCount, ConversionRate, OriginStat

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)):
    total = db.query(Lead).count()

    stages = db.query(PipelineStage).order_by(PipelineStage.display_order).all()
    by_stage = []
    won_count = 0
    for stage in stages:
        cnt = db.query(Lead).filter(Lead.stage_id == stage.id).count()
        by_stage.append(StageCount(stage_id=stage.id, stage_name=stage.name, count=cnt))
        if stage.name == "Won":
            won_count = cnt

    win_rate = round(won_count / total * 100, 2) if total > 0 else 0.0
    return DashboardSummary(total_leads=total, by_stage=by_stage, win_rate=win_rate)


@router.get("/conversions", response_model=List[ConversionRate])
def get_conversions(db: Session = Depends(get_db)):
    stages = db.query(PipelineStage).order_by(PipelineStage.display_order).all()
    stage_map = {s.id: s.name for s in stages}
    stage_count = {
        s.id: db.query(Lead).filter(Lead.stage_id == s.id).count()
        for s in stages
    }

    # Also count total leads that ever reached each stage (from history)
    ever_reached: dict[int, int] = {}
    for stage in stages:
        ever_reached[stage.id] = db.query(StageHistory).filter(
            StageHistory.to_stage_id == stage.id
        ).count()

    # Build stage pairs: New->MQL, MQL->SQL, SQL->Opportunity, Opportunity->Won
    pairs = [
        ("New", "MQL"),
        ("MQL", "SQL"),
        ("SQL", "Opportunity"),
        ("Opportunity", "Won"),
    ]
    name_to_id = {s.name: s.id for s in stages}
    result = []
    for from_name, to_name in pairs:
        fid = name_to_id.get(from_name)
        tid = name_to_id.get(to_name)
        if fid is None or tid is None:
            continue
        # from_count = leads currently at or beyond from_stage
        # Use ever_reached for better funnel representation
        from_cnt = ever_reached.get(fid, 0) + (
            db.query(Lead).filter(Lead.stage_id == fid).count()
            if from_name == "New" else 0
        )
        if from_name == "New":
            from_cnt = db.query(Lead).count()
        to_cnt = ever_reached.get(tid, 0)
        rate = round(to_cnt / from_cnt * 100, 2) if from_cnt > 0 else 0.0
        result.append(ConversionRate(
            from_stage=from_name,
            to_stage=to_name,
            from_count=from_cnt,
            to_count=to_cnt,
            rate=rate,
        ))
    return result


@router.get("/origins", response_model=List[OriginStat])
def get_origins(db: Session = Depends(get_db)):
    stages = db.query(PipelineStage).order_by(PipelineStage.display_order).all()
    stage_map = {s.id: s.name for s in stages}

    # Get distinct origins
    origins = [
        r[0] for r in db.query(Lead.origin).distinct().all()
    ]

    result = []
    for origin in origins:
        total = db.query(Lead).filter(Lead.origin == origin).count()
        by_stage = []
        for stage in stages:
            cnt = db.query(Lead).filter(
                Lead.origin == origin,
                Lead.stage_id == stage.id,
            ).count()
            if cnt > 0:
                by_stage.append(StageCount(
                    stage_id=stage.id, stage_name=stage.name, count=cnt
                ))
        result.append(OriginStat(
            origin=origin or "(unknown)",
            total=total,
            by_stage=by_stage,
        ))

    result.sort(key=lambda x: x.total, reverse=True)
    return result


@router.get("/field-values")
def get_field_values(db: Session = Depends(get_db)):
    """Data distributions for the rule builder UI."""
    total = db.query(Lead).count()

    origin_rows = (
        db.query(Lead.origin, func.count(Lead.id).label("count"))
        .group_by(Lead.origin)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    origins = [{"value": o or "(unknown)", "count": c} for o, c in origin_rows]

    min_date = db.query(func.min(Lead.first_contact_date)).scalar()
    max_date = db.query(func.max(Lead.first_contact_date)).scalar()

    return {
        "total": total,
        "origins": origins,
        "date_range": {
            "min": str(min_date) if min_date else None,
            "max": str(max_date) if max_date else None,
        },
    }
