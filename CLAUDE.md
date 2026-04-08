# FlowCRM

Sales pipeline platform — CSV lead upload, no-code rule builder, Kanban pipeline, analytics dashboard.

## Dev Commands

```bash
# Backend (always use full Anaconda path — `python` command is a broken Windows Store stub)
cd backend
/c/Users/DELL/anaconda3/python.exe -m uvicorn app.main:app --reload --port 8001

# Frontend
cd frontend
npm run dev    # http://localhost:5173
```

Backend runs on **8001**. `frontend/src/api/client.js` points to `http://localhost:8001`.

## Project Structure

```
backend/app/
├── routers/
│   ├── leads.py         CSV upload/import/analyze, lead CRUD, /api/leads/fields
│   ├── pipeline.py      Kanban view + stages list
│   ├── rules.py         Rule CRUD, evaluate-all, live preview, /summarize
│   └── dashboard.py     Analytics + field-values
└── services/
    ├── csv_service.py   Parse + bulk insert (batches of 500, dedup on mql_id)
    ├── rule_engine.py   Condition evaluator + batch stage advancement
    ├── mapping_service.py  Smart column auto-mapper (rapidfuzz, confidence scores)
    └── dq_service.py    Data quality analyzer (fill rate, type checks, duplicates)

frontend/src/
├── pages/               Dashboard, Pipeline, Upload (4-step), Rules, LeadDetail
└── components/          RuleRow (multi-select slicer), FileDropzone, etc.
```

## Rule Engine

Block-based conditions: `[{_join, logic, conditions:[{field, operator, value}]}]`
- `_join` — how this block connects to the previous one (AND/OR)
- `logic` — how conditions within the block combine (AND/OR)
- `_evaluate_node` → `_evaluate_block` → `_eval_single` handles all formats
- `evaluate_all(db)` advances leads in pipeline order, never skips stages

Operators: `eq`, `neq`, `in`, `not_in`, `gt`, `lt`, `gte`, `lte`, `before`, `after`, `contains`, `not_contains`

Conditions stored in DB as: `{"logic": "and", "items": [blocks array]}`

## Key API Endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/leads/upload` | Returns columns + rows + mapping suggestions + confidence scores |
| `POST /api/leads/analyze` | Data quality report before import |
| `POST /api/leads/import` | Form-data: file + column mapping fields |
| `GET /api/leads/fields` | All fields (standard + extra_data) with types and distinct values |
| `POST /api/rules/evaluate` | Runs all active rules against all leads |
| `POST /api/rules/preview-conditions` | Live match count — accepts full blocks array |
| `POST /api/rules/summarize` | GPT-4o-mini returns JSON array of phrases, one per block |

## Upload Flow (4 steps)

1. Upload CSV → auto-maps columns via rapidfuzz with confidence scores
2. Map Columns — confirm/adjust mapping, confidence badges, unmapped columns shown
3. Data Quality — fill rates, type mismatches, duplicates, `can_proceed` flag
4. Done

## Gotchas

- **Always use `/c/Users/DELL/anaconda3/python.exe`** — `python`/`python3` are broken Windows Store stubs
- **Declare static routes before `/{id}` routes** in FastAPI — param catches them and returns 422
- **Kill stale uvicorn via Python subprocess** — `taskkill` through `cmd /c` is unreliable: `subprocess.run(['taskkill', '/PID', pid, '/F'])`
- **`GET /api/leads/fields` must come before `GET /{lead_id}`** in leads.py
- **`/api/rules/summarize` and `/preview-conditions` must come before `/{rule_id}/preview`** in rules.py
- **OPENAI_API_KEY** lives in `.env` at project root — loaded in `main.py` via `load_dotenv`
- **Type inference** in `/fields`: numeric check runs FIRST before date keyword check — prevents numeric fields being typed as date
