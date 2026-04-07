from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Lead, PipelineStage
from ..schemas import PipelineView, KanbanColumn, KanbanLeadCard, PipelineStageOut

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/stages", response_model=list[PipelineStageOut])
def list_stages(db: Session = Depends(get_db)):
    return db.query(PipelineStage).order_by(PipelineStage.display_order).all()


@router.get("", response_model=PipelineView)
def get_pipeline(db: Session = Depends(get_db)):
    stages = db.query(PipelineStage).order_by(PipelineStage.display_order).all()
    columns = []

    for stage in stages:
        total = db.query(Lead).filter(Lead.stage_id == stage.id).count()
        leads = (
            db.query(Lead)
            .filter(Lead.stage_id == stage.id)
            .order_by(Lead.created_at.desc())
            .limit(50)
            .all()
        )
        columns.append(KanbanColumn(
            stage=PipelineStageOut.model_validate(stage),
            leads=[KanbanLeadCard.model_validate(l) for l in leads],
            total=total,
        ))

    return PipelineView(columns=columns)
