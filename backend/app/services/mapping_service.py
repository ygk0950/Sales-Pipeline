from __future__ import annotations

import json
import os
import re
import logging
from typing import List, Optional

from openai import OpenAI
from rapidfuzz import fuzz

from ..schemas import ColumnMappingSuggestion, AutoMapResult

logger = logging.getLogger(__name__)

# Standard fields with human labels and known aliases
FIELD_CONFIG = {
    "mql_id": {
        "label": "Lead ID",
        "aliases": [
            "mql_id", "mqlid", "lead id", "leadid", "mql", "lead_id",
            "marketing qualified lead id", "id", "lead_identifier",
            "lead identifier", "mqls id",
        ],
    },
    "first_contact_date": {
        "label": "First Contact Date",
        "aliases": [
            "first_contact_date", "first contact date", "contact date",
            "first contact", "contact_date", "first_contact", "created",
            "signup date", "signup_date", "date", "created_date",
            "registration date", "reg date",
        ],
    },
    "landing_page_id": {
        "label": "Landing Page",
        "aliases": [
            "landing_page_id", "landing page id", "landing page",
            "page id", "lp_id", "page", "landing", "landingpage",
            "landing_page", "page_id",
        ],
    },
    "origin": {
        "label": "Channel",
        "aliases": [
            "origin", "source", "channel", "utm_source", "lead source",
            "lead_source", "traffic source", "traffic_source", "referrer",
            "medium", "utm_medium", "acquisition source",
        ],
    },
}

STANDARD_FIELDS = ["mql_id", "first_contact_date", "landing_page_id", "origin"]

STANDARD_FIELD_TYPES = {
    "mql_id": "text",
    "first_contact_date": "date",
    "landing_page_id": "text",
    "origin": "text",
}

STANDARD_FIELD_DATE_FORMATS = {
    "first_contact_date": "dateutil",  # will be overridden by LLM if needed
}


def _normalize(s: str) -> str:
    """Lowercase, collapse non-alphanumeric to single space, strip."""
    return "".join(c if c.isalnum() else " " for c in s.lower()).strip()


def _fallback_readable_name(raw: str) -> str:
    """Simple heuristic fallback: convert snake_case/camelCase to Title Case."""
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw)
    s = re.sub(r"[_\-\.]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.title()


def _score_column(csv_col: str, aliases: list[str]) -> tuple[float, str]:
    """Return (confidence, matched_alias) for a CSV column against a set of aliases."""
    norm_col = _normalize(csv_col)

    for alias in aliases:
        if norm_col == _normalize(alias):
            return 1.0, alias

    for alias in aliases:
        norm_alias = _normalize(alias)
        if len(norm_alias) >= 3 and (norm_alias in norm_col or norm_col in norm_alias):
            return 0.85, alias

    best_score = 0.0
    best_alias = ""
    for alias in aliases:
        score = fuzz.token_sort_ratio(norm_col, _normalize(alias))
        if score > best_score:
            best_score = score
            best_alias = alias

    if best_score >= 70:
        return round(best_score / 100, 2), best_alias

    return 0.0, ""


def _llm_generate_names(
    columns_with_samples: list[dict],
) -> dict[str, dict]:
    """Returns dict of {col: {"label": str, "type": str}}"""
    """Call OpenAI to generate human-readable field names.

    Args:
        columns_with_samples: list of {"column": str, "samples": list[str]}

    Returns:
        dict mapping column name -> readable label
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set, falling back to heuristic naming")
        return {}

    col_info = "\n".join(
        f"- Column: \"{c['column']}\" | Sample values: {c['samples'][:5]}"
        for c in columns_with_samples
    )

    prompt = f"""You are a CRM data analyst. Given CSV column names and sample values, return a JSON object for each column with:
1. "label": clean human-readable field name
2. "type": one of "text", "number", "date", "boolean"
3. "format": (only for date columns) the Python strptime format string, OR one of these special keywords:
   - "excel_serial" if values are integers like 44927, 45291 (Excel date serial numbers)
   - "unix_s" if values are 10-digit Unix timestamps (seconds)
   - "unix_ms" if values are 13-digit Unix timestamps (milliseconds)
   - "dateutil" if dateutil can parse them (standard readable formats)

Rules for labels:
- Clear and professional, no underscores, no camelCase
- Title case, 2-4 words max

Rules for types:
- "date": any date/datetime values including Excel serials, Unix timestamps, or text dates
- "number": numeric values (counts, scores, amounts)
- "boolean": yes/no, true/false, 0/1
- "text": names, IDs, categories, freeform

Columns:
{col_info}

Respond ONLY with flat JSON. No markdown.
Example: {{"first_contact_date": {{"label": "First Contact Date", "type": "date", "format": "%Y-%m-%d"}}, "created_ts": {{"label": "Created Date", "type": "date", "format": "unix_ms"}}, "visits": {{"label": "Website Visits", "type": "number"}}}}"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=600,
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        return json.loads(text)
    except Exception as e:
        logger.error(f"LLM naming failed: {e}")
        return {}


def auto_map_columns(
    csv_columns: List[str],
    sample_rows: Optional[List[dict]] = None,
) -> AutoMapResult:
    """Map CSV columns to standard Lead fields with confidence scores.

    All CSV columns get a suggestion. Standard fields are matched via aliases/fuzzy.
    Remaining columns get LLM-generated readable names (with heuristic fallback).
    """

    # Score every (target_field, csv_column) pair for standard fields
    scores: dict[str, list[tuple[float, str]]] = {}
    for field in STANDARD_FIELDS:
        aliases = FIELD_CONFIG[field]["aliases"]
        scored = []
        for col in csv_columns:
            conf, _ = _score_column(col, aliases)
            if conf > 0:
                scored.append((conf, col))
        scored.sort(key=lambda x: -x[0])
        scores[field] = scored

    # Greedy assignment
    assigned_columns: set[str] = set()
    assignments: dict[str, tuple[float, str]] = {}

    all_candidates = []
    for field, scored in scores.items():
        for conf, col in scored:
            all_candidates.append((conf, field, col))
    all_candidates.sort(key=lambda x: -x[0])

    for conf, field, col in all_candidates:
        if field in assignments or col in assigned_columns:
            continue
        assignments[field] = (conf, col)
        assigned_columns.add(col)

    # For standard date fields that were matched, ask LLM to detect format from samples
    std_date_formats: dict[str, str] = {}
    date_fields_to_check = [
        {"column": col, "samples": [r.get(col, "") for r in (sample_rows or [])[:5] if r.get(col, "")]}
        for field, (conf, col) in assignments.items()
        if STANDARD_FIELD_TYPES.get(field) == "date"
    ]
    if date_fields_to_check:
        llm_std = _llm_generate_names(date_fields_to_check)
        for item in date_fields_to_check:
            col = item["column"]
            info = llm_std.get(col, {})
            if isinstance(info, dict) and info.get("format"):
                std_date_formats[col] = info["format"]

    # Build suggestions for standard fields
    suggestions = []
    for field in STANDARD_FIELDS:
        if field in assignments:
            conf, col = assignments[field]
            date_fmt = std_date_formats.get(col, STANDARD_FIELD_DATE_FORMATS.get(field))
            suggestions.append(ColumnMappingSuggestion(
                target_field=field,
                target_label=FIELD_CONFIG[field]["label"],
                csv_column=col,
                confidence=conf,
                needs_review=conf < 0.8,
                is_standard=True,
                data_type=STANDARD_FIELD_TYPES[field],
                date_format=date_fmt,
            ))
        else:
            suggestions.append(ColumnMappingSuggestion(
                target_field=field,
                target_label=FIELD_CONFIG[field]["label"],
                csv_column=None,
                confidence=0.0,
                needs_review=True,
                is_standard=True,
                data_type=STANDARD_FIELD_TYPES[field],
                date_format=STANDARD_FIELD_DATE_FORMATS.get(field),
            ))

    # For remaining columns, use LLM to generate readable names + types
    remaining_cols = [c for c in csv_columns if c not in assigned_columns]
    if remaining_cols:
        cols_with_samples = []
        for col in remaining_cols:
            samples = []
            if sample_rows:
                for row in sample_rows[:5]:
                    val = row.get(col, "")
                    if val:
                        samples.append(str(val))
            cols_with_samples.append({"column": col, "samples": samples})

        llm_result = _llm_generate_names(cols_with_samples)

        for item in cols_with_samples:
            col = item["column"]
            llm_info = llm_result.get(col, {})
            # Handle both old format (str) and new format (dict)
            if isinstance(llm_info, dict):
                readable = llm_info.get("label") or _fallback_readable_name(col)
                data_type = llm_info.get("type", "text")
                date_format = llm_info.get("format") if data_type == "date" else None
            else:
                readable = llm_info or _fallback_readable_name(col)
                data_type = "text"
                date_format = None
            clean_field = _normalize(col).replace(" ", "_")
            suggestions.append(ColumnMappingSuggestion(
                target_field=clean_field,
                target_label=readable,
                csv_column=col,
                confidence=1.0,
                needs_review=False,
                is_standard=False,
                data_type=data_type,
                date_format=date_format,
            ))

    return AutoMapResult(
        suggestions=suggestions,
        unmapped_csv_columns=[],
    )
