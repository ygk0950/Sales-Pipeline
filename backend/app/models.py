from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date,
    ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    display_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    leads = relationship("Lead", back_populates="stage")
    rules = relationship("Rule", back_populates="target_stage")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    mql_id = Column(String(64), unique=True, nullable=False, index=True)
    first_contact_date = Column(Date, nullable=True)
    landing_page_id = Column(String(64), nullable=True)
    origin = Column(String(50), nullable=True)
    stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    qualified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stage = relationship("PipelineStage", back_populates="leads")
    history = relationship("StageHistory", back_populates="lead", order_by="StageHistory.changed_at")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    target_stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    conditions = Column(Text, nullable=False)  # JSON string
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    target_stage = relationship("PipelineStage", back_populates="rules")


class StageHistory(Base):
    __tablename__ = "stage_history"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    from_stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=True)
    to_stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="history")
    from_stage = relationship("PipelineStage", foreign_keys=[from_stage_id])
    to_stage = relationship("PipelineStage", foreign_keys=[to_stage_id])
    rule = relationship("Rule", foreign_keys=[rule_id])
