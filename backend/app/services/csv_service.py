import csv
import io
from datetime import date
from typing import List, Tuple

from sqlalchemy.orm import Session

from ..models import Lead, PipelineStage
from ..schemas import ColumnMapping, CSVPreview, ImportResult


DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]


def _parse_date(value: str) -> date | None:
    if not value or not value.strip():
        return None
    for fmt in DATE_FORMATS:
        try:
            from datetime import datetime
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def preview_csv(content: bytes) -> CSVPreview:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(dict(row))
    return CSVPreview(columns=list(columns), rows=rows)


def import_csv(
    content: bytes,
    mapping: ColumnMapping,
    db: Session,
) -> ImportResult:
    # Get the "New" stage
    new_stage = db.query(PipelineStage).filter_by(name="New").first()
    if not new_stage:
        return ImportResult(imported=0, skipped=0, errors=["Pipeline stages not seeded."])

    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors: List[str] = []

    batch: List[Lead] = []
    existing_mql_ids = {
        row[0] for row in db.query(Lead.mql_id).all()
    }

    for row_num, row in enumerate(reader, start=2):
        try:
            mql_id_val = row.get(mapping.mql_id, "").strip()
            if not mql_id_val:
                skipped += 1
                continue

            if mql_id_val in existing_mql_ids:
                skipped += 1
                continue

            fcd_val = None
            if mapping.first_contact_date:
                fcd_val = _parse_date(row.get(mapping.first_contact_date, ""))

            lp_val = None
            if mapping.landing_page_id:
                lp_val = row.get(mapping.landing_page_id, "").strip() or None

            origin_val = None
            if mapping.origin:
                origin_val = row.get(mapping.origin, "").strip() or None

            lead = Lead(
                mql_id=mql_id_val,
                first_contact_date=fcd_val,
                landing_page_id=lp_val,
                origin=origin_val,
                stage_id=new_stage.id,
            )
            batch.append(lead)
            existing_mql_ids.add(mql_id_val)
            imported += 1

            if len(batch) >= 500:
                db.bulk_save_objects(batch)
                db.commit()
                batch = []

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            skipped += 1

    if batch:
        db.bulk_save_objects(batch)
        db.commit()

    return ImportResult(imported=imported, skipped=skipped, errors=errors[:20])
