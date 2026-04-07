# FlowCRM

Sales pipeline platform — CSV lead upload, no-code rule builder, Kanban pipeline, analytics dashboard.

## Dev Commands

```bash
# Backend (always use full Anaconda path — `python` command is a broken Windows Store stub)
cd backend
/c/Users/DELL/anaconda3/python.exe -m uvicorn app.main:app --reload --port 8001
# Docs: http://localhost:8001/docs

# Frontend
cd frontend
npm run dev    # http://localhost:5173
```

Backend runs on **8001**. `frontend/src/api/client.js` points to `http://localhost:8001`.

## Project Structure

```
backend/app/
├── main.py              CORS, lifespan (creates tables + seeds 6 stages)
├── database.py          SQLAlchemy engine + get_db
├── models.py            ORM: Lead, Rule, PipelineStage, StageHistory
├── schemas.py           Pydantic v2 models
├── routers/
│   ├── leads.py         CSV upload/import, lead CRUD, stage moves
│   ├── pipeline.py      Kanban view + stages list
│   ├── rules.py         Rule CRUD, evaluate-all, live preview
│   └── dashboard.py     Analytics + field-values for rule builder
└── services/
    ├── csv_service.py   Parse + bulk insert (batches of 500, dedup on mql_id)
    └── rule_engine.py   Condition evaluator + batch stage advancement

frontend/src/
├── api/client.js        Axios → localhost:8001
├── hooks/               useLeads, usePipeline, useRules (TanStack Query)
├── pages/               Dashboard, Pipeline, Upload, Rules, LeadDetail
└── components/          Layout, KanbanColumn, KanbanCard, RuleRow, StatsCard, FileDropzone
```

## Database

Four tables, auto-created on startup. Stages seeded in `main.py` — do not reorder.

| Table | Key detail |
|---|---|
| `pipeline_stages` | New → MQL → SQL → Opportunity → Won / Lost (fixed order) |
| `leads` | `stage_id` FK = current position |
| `rules` | `conditions` column is a JSON string; `target_stage_id` FK |
| `stage_history` | Every move logged; `rule_id` is null for manual moves |

## Rule Engine

`evaluate_all(db)` advances leads in pipeline order — never skips stages. A lead at New matching an SQL rule goes New → MQL → SQL in one pass.

Operators: `eq`, `neq`, `in`, `not_in`, `gt`, `lt`, `gte`, `lte`, `before`, `after`

## Key API Endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/leads/upload` | Preview only — returns columns + 5 rows |
| `POST /api/leads/import` | Form-data with file + column mapping |
| `PATCH /api/leads/{id}/stage` | Manual move; null rule_id in history |
| `GET /api/pipeline` | Stages with up to 50 leads each |
| `POST /api/rules/evaluate` | Runs all active rules against all leads |
| `POST /api/rules/preview-conditions` | Live match count for unsaved conditions |
| `GET /api/dashboard/field-values` | Origin counts + date range for rule builder |

## Gotchas

- **Always use `/c/Users/DELL/anaconda3/python.exe`** — `python`/`python3` are broken Windows Store stubs
- **Declare static routes before `/{id}` routes** in FastAPI routers — otherwise the param catches them and returns 422
- **Kill stale uvicorn via Python subprocess** — `taskkill` through `cmd /c` in this bash env doesn't work reliably: `subprocess.run(['taskkill', '/PID', pid, '/F'])`
