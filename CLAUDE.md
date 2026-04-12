# FlowCRM

Sales pipeline platform — CSV lead upload, no-code rule builder, node-based pipeline view, analytics dashboard.

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
│   ├── leads.py         CSV upload/import/analyze, lead CRUD, /api/leads/fields, flush-stage, DELETE /all
│   ├── pipeline.py      Pipeline view + stages list
│   ├── rules.py         Rule CRUD, evaluate-all, live preview, /summarize
│   └── dashboard.py     Analytics + field-values
└── services/
    ├── csv_service.py      Parse + bulk insert (batches of 500, dedup on mql_id)
    ├── rule_engine.py      Condition evaluator + batch stage advancement
    ├── mapping_service.py  Smart column auto-mapper (rapidfuzz, confidence scores)
    └── dq_service.py       Data quality analyzer (fill rate, type checks, duplicates)

frontend/src/
├── pages/
│   ├── Workspace.jsx    Tab shell: Dashboard / Pipeline / Rules (nav tabs top-left)
│   ├── Dashboard.jsx    Analytics
│   ├── Pipeline.jsx     Pipeline page — state, handlers, run/flush/reset wiring
│   ├── Upload.jsx       4-step CSV upload wizard
│   ├── Rules.jsx        Rule list + builder
│   └── LeadDetail.jsx
├── components/
│   └── pipeline/
│       ├── PipelineFlow.jsx   Node layout + ForkConnector for parallel terminals
│       ├── StageNode.jsx      Circle node — Run/Reset pill pair, rules list
│       ├── UploadNode.jsx     Upload CSV node — goes green after import, Reset button
│       ├── RuleDrawer.jsx     Slide-in rule builder
│       └── UploadModal.jsx    Modal wrapper for Upload wizard
└── hooks/
    ├── usePipeline.js   usePipeline, useStages, useFlushStage, useResetAllLeads
    └── useRules.js      useRules, useCreateRule, useUpdateRule, useDeleteRule,
                         useEvaluateRules, useEvaluateStageRules
```

## Pipeline Stages

Seeded in `main.py` → `seed_stages()`. Order matters for rule advancement.

| Order | Name        | Type        | Notes                                  |
|-------|-------------|-------------|----------------------------------------|
| 0     | New         | Entry       | Merged into UploadNode, not shown      |
| 1     | MQL         | Advanceable | Rules run here                         |
| 2     | SQL         | Advanceable | Rules run here                         |
| 3     | Opportunity | Advanceable | Rules run here                         |
| 4     | Won         | Terminal    | Manual only — shown in fork column     |
| 5     | Nurture     | Terminal    | Manual only — shown in fork column     |
| 6     | Lost        | Terminal    | Manual only — shown in fork column     |

`TERMINAL_STAGES = {"Won", "Nurture", "Lost"}` in `rule_engine.py` — excluded from auto-advance; all flush back to Opportunity.

## Pipeline Layout (PipelineFlow.jsx)

```
[Upload] ──── [MQL] ──── [SQL] ──── [Opportunity] ────┬──► [Won]
                                                        ├──► [Nurture]   ← main flow aligns here
                                                        └──► [Lost]
```

- Main flow nodes + FlexConnectors sit in a wrapper with `marginTop = midIdx × (NODE_H + GAP)` so the pipeline circles centre on the middle terminal node (Nurture).
- `ForkConnector` SVG: vertical spine from Won→Lost, three arrowhead arms. Middle arm (`midIdx`) starts at `x=0` for seamless join with the incoming connector. Last FlexConnector before the fork uses `noArrow` to avoid double arrowheads.
- `NODE_H = 136`, `GAP = 32` (gap-8) — these must match the actual rendered terminal node height.

## Rule Engine

Block-based conditions: `[{_join, logic, conditions:[{field, operator, value}]}]`
- `_join` — how this block connects to the previous one (AND/OR)
- `logic` — how conditions within the block combine (AND/OR)
- `_evaluate_node` → `_evaluate_block` → `_eval_single` handles all formats
- `evaluate_all(db)` advances leads in pipeline order, never skips stages
- Terminal stages excluded from auto-advance via `TERMINAL_STAGES` set

Operators: `eq`, `neq`, `in`, `not_in`, `gt`, `lt`, `gte`, `lte`, `before`, `after`, `contains`, `not_contains`

Conditions stored in DB as: `{"logic": "and", "items": [blocks array]}`

## Key API Endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/leads/upload` | Returns columns + rows + mapping suggestions + confidence scores |
| `POST /api/leads/analyze` | Data quality report before import |
| `POST /api/leads/import` | Form-data: file + column mapping fields |
| `GET /api/leads/fields` | All fields (standard + extra_data) with types and distinct values |
| `POST /api/leads/flush-stage?stage_id=N` | Move all leads in stage back to Opportunity (terminals) or prev stage |
| `DELETE /api/leads/all` | Wipe all leads + stage history |
| `POST /api/rules/evaluate` | Runs all active rules against all leads |
| `POST /api/rules/evaluate?stage_id=N` | Runs rules for a single stage |
| `POST /api/rules/preview-conditions` | Live match count — accepts full blocks array |
| `POST /api/rules/summarize` | GPT-4o-mini returns JSON array of phrases, one per block |

## Upload Flow (4 steps)

1. Upload CSV → auto-maps columns via rapidfuzz with confidence scores
2. Map Columns — confirm/adjust mapping, confidence badges, unmapped columns shown
3. Data Quality — fill rates, type mismatches, duplicates, `can_proceed` flag
4. Done — clicking "View Pipeline →" triggers `onSuccess` callback, turns UploadNode green

## Gotchas

- **Always use `/c/Users/DELL/anaconda3/python.exe`** — `python`/`python3` are broken Windows Store stubs
- **Restart backend to seed new stages** — `seed_stages()` only runs at startup (lifespan event)
- **Declare static routes before `/{id}` routes** in FastAPI — param catches them and returns 422
- **Kill stale uvicorn via Python subprocess** — `taskkill` through `cmd /c` is unreliable: `subprocess.run(['taskkill', '/PID', pid, '/F'])`
- **`GET /api/leads/fields` must come before `GET /{lead_id}`** in leads.py
- **`/api/rules/summarize` and `/preview-conditions` must come before `/{rule_id}/preview`** in rules.py
- **OPENAI_API_KEY** lives in `.env` at project root — loaded in `main.py` via `load_dotenv`
- **Type inference** in `/fields`: numeric check runs FIRST before date keyword check — prevents numeric fields being typed as date
- **ForkConnector pixel constants** (`NODE_H`, `GAP`) must stay in sync with actual terminal node CSS — if terminal node height changes, update both
