from __future__ import annotations

import csv
import io
import re
from collections import Counter
from typing import List, Optional

from dateutil.parser import parse as dateutil_parse, ParserError

from ..schemas import ColumnMapping, ColumnIssue, DataQualityReport


def _try_parse_date(value: str, fmt: Optional[str] = None) -> bool:
    """Try to parse a date value using the given format hint."""
    v = value.strip()
    if not v:
        return False
    try:
        if fmt == "excel_serial":
            float(v)  # just check it's numeric
            return True
        elif fmt == "unix_s":
            int(v)
            return True
        elif fmt == "unix_ms":
            int(v)
            return True
        elif fmt and fmt != "dateutil":
            from datetime import datetime
            datetime.strptime(v, fmt)
            return True
        else:
            dateutil_parse(v, dayfirst=False)
            return True
    except (ParserError, ValueError, OverflowError):
        return False


def _date_format_bucket(value: str, fmt: Optional[str] = None) -> Optional[str]:
    """Classify date format family for consistency checks."""
    if not _try_parse_date(value, fmt):
        return None
    if fmt and fmt not in ("dateutil", "excel_serial", "unix_s", "unix_ms"):
        return fmt  # user-specified format — all same bucket
    if fmt in ("excel_serial", "unix_s", "unix_ms"):
        return fmt
    v = value.strip()
    if re.match(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}", v):
        return "YYYY-MM-DD"
    elif re.match(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", v):
        return "DD/MM or MM/DD"
    elif re.match(r"\d{1,2}\s+\w+\s+\d{4}", v):
        return "DD Month YYYY"
    elif re.match(r"\w+\s+\d{1,2},?\s+\d{4}", v):
        return "Month DD YYYY"
    return "other"


def _is_number(value: str) -> bool:
    try:
        float(value.replace(",", ""))
        return True
    except ValueError:
        return False


BOOLEAN_VALUES = {"yes", "no", "true", "false", "1", "0", "y", "n", "t", "f", "checked", "unchecked"}


def _is_boolean(value: str) -> bool:
    return value.strip().lower() in BOOLEAN_VALUES


def analyze_data_quality(content: bytes, mapping: ColumnMapping) -> DataQualityReport:
    """Run data quality checks on the full CSV given a confirmed column mapping."""

    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    # Build full column list: (csv_column, target_field, is_standard, data_type, date_fmt)
    all_mapped: list[tuple[str, str, bool, str, Optional[str]]] = []

    standard_fields = {
        "mql_id": (mapping.mql_id, "text"),
        "first_contact_date": (mapping.first_contact_date, "date"),
        "landing_page_id": (mapping.landing_page_id, "text"),
        "origin": (mapping.origin, "text"),
    }
    for field, (csv_col, default_type) in standard_fields.items():
        if csv_col:
            actual_type = (mapping.column_types or {}).get(csv_col, default_type)
            date_fmt = (mapping.date_formats or {}).get(csv_col) if actual_type == "date" else None
            all_mapped.append((csv_col, field, True, actual_type, date_fmt))

    if mapping.extra_columns:
        for csv_col, target_name in mapping.extra_columns.items():
            actual_type = (mapping.column_types or {}).get(csv_col, "text")
            date_fmt = (mapping.date_formats or {}).get(csv_col) if actual_type == "date" else None
            all_mapped.append((csv_col, target_name, False, actual_type, date_fmt))

    # Accumulators
    total_rows = 0
    fill_counts: dict[str, int] = {t[0]: 0 for t in all_mapped}
    unique_values: dict[str, set] = {t[0]: set() for t in all_mapped}
    sample_values: dict[str, list] = {t[0]: [] for t in all_mapped}
    type_failures: dict[str, int] = {t[0]: 0 for t in all_mapped}
    date_format_counts: dict[str, Counter] = {t[0]: Counter() for t in all_mapped}
    mql_id_counts: Counter = Counter()

    for row in reader:
        total_rows += 1
        for csv_col, target_field, is_standard, data_type, date_fmt in all_mapped:
            val = row.get(csv_col, "").strip()
            if val:
                fill_counts[csv_col] += 1
                unique_values[csv_col].add(val)
                if len(sample_values[csv_col]) < 5:
                    sample_values[csv_col].append(val)

                # Type validation
                if data_type == "date":
                    bucket = _date_format_bucket(val, date_fmt)
                    if bucket:
                        date_format_counts[csv_col][bucket] += 1
                    else:
                        type_failures[csv_col] += 1
                elif data_type == "number":
                    if not _is_number(val):
                        type_failures[csv_col] += 1
                elif data_type == "boolean":
                    if not _is_boolean(val):
                        type_failures[csv_col] += 1

            if target_field == "mql_id" and val:
                mql_id_counts[val] += 1

    if total_rows == 0:
        return DataQualityReport(
            total_rows=0,
            issues=[ColumnIssue(
                column="(file)", target_field=None,
                issue_type="empty_file", severity="error",
                message="The CSV file contains no data rows.",
            )],
            column_stats={}, summary="0 rows — file is empty", can_proceed=False,
        )

    issues: List[ColumnIssue] = []

    for csv_col, target_field, is_standard, data_type, date_fmt in all_mapped:
        fill_rate = fill_counts[csv_col] / total_rows
        unique_count = len(unique_values[csv_col])
        failures = type_failures[csv_col]

        # Fill rate
        if target_field == "mql_id" and fill_rate < 1.0:
            missing = total_rows - fill_counts[csv_col]
            issues.append(ColumnIssue(
                column=csv_col, target_field=target_field,
                issue_type="low_fill_rate", severity="error",
                message=f"Lead ID has {missing} empty value(s) — all rows need a Lead ID.",
                detail={"fill_rate": round(fill_rate, 3), "missing": missing},
            ))
        elif fill_rate < 0.5:
            missing = total_rows - fill_counts[csv_col]
            issues.append(ColumnIssue(
                column=csv_col, target_field=target_field,
                issue_type="low_fill_rate", severity="warning",
                message=f"'{csv_col}' is only {fill_rate:.0%} filled ({missing} empty values).",
                detail={"fill_rate": round(fill_rate, 3), "missing": missing},
            ))

        # Type failures
        if failures > 0:
            pct = round(failures / fill_counts[csv_col] * 100, 1) if fill_counts[csv_col] else 0
            issues.append(ColumnIssue(
                column=csv_col, target_field=target_field,
                issue_type="type_mismatch", severity="warning",
                message=f"{failures} value(s) ({pct}%) in '{csv_col}' don't look like {data_type}.",
                detail={"failures": failures, "sample_invalid": sample_values[csv_col][:3]},
            ))

        # Inconsistent date formats
        if data_type == "date" and len(date_format_counts[csv_col]) > 1:
            fmt_list = ", ".join(
                f"{fmt} ({cnt})" for fmt, cnt in date_format_counts[csv_col].most_common()
            )
            issues.append(ColumnIssue(
                column=csv_col, target_field=target_field,
                issue_type="inconsistent_format", severity="warning",
                message=f"Mixed date formats in '{csv_col}': {fmt_list}.",
                detail={"formats": dict(date_format_counts[csv_col])},
            ))

        # High cardinality for channel/origin
        if target_field == "origin" and unique_count > 50:
            issues.append(ColumnIssue(
                column=csv_col, target_field=target_field,
                issue_type="high_cardinality", severity="warning",
                message=f"'{csv_col}' has {unique_count} unique values — may be free-text, not categorical.",
                detail={"unique_count": unique_count},
            ))

    # Duplicates
    duplicate_count = sum(1 for v in mql_id_counts.values() if v > 1)
    if duplicate_count > 0:
        total_dupes = sum(v - 1 for v in mql_id_counts.values() if v > 1)
        issues.append(ColumnIssue(
            column=mapping.mql_id, target_field="mql_id",
            issue_type="duplicates", severity="warning",
            message=f"{duplicate_count} Lead ID(s) appear more than once ({total_dupes} duplicate rows).",
            detail={"duplicate_ids": duplicate_count, "duplicate_rows": total_dupes},
        ))

    # Column stats
    column_stats = {}
    for csv_col, target_field, is_standard, data_type, date_fmt in all_mapped:
        fill_rate = fill_counts[csv_col] / total_rows
        column_stats[csv_col] = {
            "target_field": target_field,
            "data_type": data_type,
            "fill_rate": round(fill_rate, 3),
            "filled": fill_counts[csv_col],
            "total": total_rows,
            "unique_count": len(unique_values[csv_col]),
            "sample_values": sample_values[csv_col],
            "is_standard": is_standard,
        }

    error_count = sum(1 for i in issues if i.severity == "error")
    warning_count = sum(1 for i in issues if i.severity == "warning")
    parts = []
    if error_count:
        parts.append(f"{error_count} error(s)")
    if warning_count:
        parts.append(f"{warning_count} warning(s)")
    summary_detail = ", ".join(parts) if parts else "No issues found"

    return DataQualityReport(
        total_rows=total_rows,
        issues=issues,
        column_stats=column_stats,
        summary=f"{total_rows:,} rows analyzed. {summary_detail}.",
        can_proceed=error_count == 0,
    )
