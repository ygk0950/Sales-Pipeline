from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from project root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal, Base
from .models import PipelineStage
from .routers import leads, pipeline, rules, dashboard


PIPELINE_STAGES = [
    ("New", 0),
    ("MQL", 1),
    ("SQL", 2),
    ("Opportunity", 3),
    ("Won", 4),
    ("Lost", 5),
]


def seed_stages(db: Session):
    for name, order in PIPELINE_STAGES:
        existing = db.query(PipelineStage).filter_by(name=name).first()
        if not existing:
            db.add(PipelineStage(name=name, display_order=order))
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_stages(db)
    finally:
        db.close()
    yield


app = FastAPI(title="FlowCRM API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads.router)
app.include_router(pipeline.router)
app.include_router(rules.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {"message": "FlowCRM API", "docs": "/docs"}
