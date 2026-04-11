#!/usr/bin/env python3
"""
Ingest CMS Hospital Complications and Deaths (yc9t-dgbk) and
Hospital Readmissions (9n3s-kdb3) into hospital_quality.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

CMS_QUERY_BASE = "https://data.cms.gov/provider-data/api/1/datastore/query"
COMPLICATIONS_DATASET = "yc9t-dgbk"
READMISSIONS_DATASET = "9n3s-kdb3"
PAGE_LIMIT = 1000
INGEST_YEAR = 2024

# Canonical measure_id values stored in DB (CMS codes; Hybrid_HWM as specified).
COMPLICATION_MEASURE_CANONICAL: dict[str, str] = {
    "COMP_HIP_KNEE": "COMP_HIP_KNEE",
    "PSI_11": "PSI_11",
    "MORT_30_CABG": "MORT_30_CABG",
    "HYBRID_HWM": "Hybrid_HWM",
}
READMISSION_MEASURE_ID = "READM_30_HOSP_WIDE"

UPSERT_SQL = """
    INSERT INTO hospital_quality (ccn, measure_id, score, compared_to_national, year)
    VALUES %s
    ON CONFLICT (ccn, measure_id) DO UPDATE SET
        score = EXCLUDED.score,
        compared_to_national = EXCLUDED.compared_to_national,
        year = EXCLUDED.year
"""
BATCH_SIZE = 500


def _parse_score(raw: Any) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    low = s.lower()
    if low in ("not available", "n/a", "na"):
        return None
    if "too few" in low or "too small" in low:
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def _parse_text(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _record_ccn(record: dict[str, Any]) -> str | None:
    """Map facility_id (or CMS CCN column) to ccn."""
    v = record.get("facility_id")
    if v is None or (isinstance(v, str) and not v.strip()):
        v = record.get("cms_certification_number_ccn")
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _normalized_measure_id(record: dict[str, Any]) -> str | None:
    mid = record.get("measure_id")
    if mid is not None and str(mid).strip():
        return str(mid).strip()
    mn = record.get("measure_name")
    if mn is None or not str(mn).strip():
        return None
    return str(mn).replace("-", "_").upper()


def _canonical_complication_measure(record: dict[str, Any]) -> str | None:
    raw = _normalized_measure_id(record)
    if not raw:
        return None
    return COMPLICATION_MEASURE_CANONICAL.get(raw.upper())


def _readmission_measure_matches(record: dict[str, Any]) -> bool:
    mid = record.get("measure_id")
    if mid is not None and str(mid).strip() == READMISSION_MEASURE_ID:
        return True
    norm = _normalized_measure_id(record)
    if not norm:
        return False
    if norm == READMISSION_MEASURE_ID:
        return True
    # e.g. READM_30_HOSP_WIDE_HRRP
    return norm.startswith(f"{READMISSION_MEASURE_ID}_")


def _readmission_score(record: dict[str, Any]) -> float | None:
    for key in ("score", "excess_readmission_ratio"):
        if key in record:
            return _parse_score(record.get(key))
    return None


def fetch_paginated(dataset_id: str) -> list[dict[str, Any]]:
    offset = 0
    all_rows: list[dict[str, Any]] = []
    session = requests.Session()
    base = f"{CMS_QUERY_BASE}/{dataset_id}/0"
    while True:
        url = f"{base}?limit={PAGE_LIMIT}&offset={offset}"
        logger.info("GET %s", url)
        try:
            resp = session.get(url, timeout=120)
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.exception("CMS API request failed: %s", e)
            raise
        try:
            payload = resp.json()
        except ValueError as e:
            logger.exception("Invalid JSON from CMS API: %s", e)
            raise
        batch = payload.get("results") or []
        if not batch:
            break
        all_rows.extend(batch)
        logger.info("Fetched %s records (offset=%s)", len(batch), offset)
        if len(batch) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
    return all_rows


def load_valid_ccns(cur: Any) -> set[str]:
    cur.execute("SELECT ccn FROM hospitals")
    return {row[0] for row in cur.fetchall() if row[0]}


def build_complication_rows(
    records: list[dict[str, Any]],
    valid_ccns: set[str],
) -> tuple[list[tuple[Any, ...]], int, int]:
    """Returns (rows for upsert, upsert_count after dedupe, skipped_unknown_ccn)."""
    skipped_ccn = 0
    by_key: dict[tuple[str, str], tuple[Any, ...]] = {}
    for rec in records:
        mid = _canonical_complication_measure(rec)
        if not mid:
            continue
        ccn = _record_ccn(rec)
        if not ccn:
            continue
        if ccn not in valid_ccns:
            skipped_ccn += 1
            continue
        score = _parse_score(rec.get("score"))
        cmp_nat = _parse_text(rec.get("compared_to_national"))
        by_key[(ccn, mid)] = (ccn, mid, score, cmp_nat, INGEST_YEAR)
    rows = list(by_key.values())
    return rows, len(rows), skipped_ccn


def build_readmission_rows(
    records: list[dict[str, Any]],
    valid_ccns: set[str],
) -> tuple[list[tuple[Any, ...]], int, int]:
    skipped_ccn = 0
    by_key: dict[tuple[str, str], tuple[Any, ...]] = {}
    for rec in records:
        if not _readmission_measure_matches(rec):
            continue
        ccn = _record_ccn(rec)
        if not ccn:
            continue
        if ccn not in valid_ccns:
            skipped_ccn += 1
            continue
        score = _readmission_score(rec)
        cmp_nat = _parse_text(rec.get("compared_to_national"))
        by_key[(ccn, READMISSION_MEASURE_ID)] = (
            ccn,
            READMISSION_MEASURE_ID,
            score,
            cmp_nat,
            INGEST_YEAR,
        )
    rows = list(by_key.values())
    return rows, len(rows), skipped_ccn


def upsert_batches(cur: Any, rows: list[tuple[Any, ...]]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        execute_values(cur, UPSERT_SQL, chunk, page_size=BATCH_SIZE)


def main() -> int:
    load_dotenv()
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        return 1

    try:
        compl_raw = fetch_paginated(COMPLICATIONS_DATASET)
        read_raw = fetch_paginated(READMISSIONS_DATASET)
    except Exception:
        return 1

    conn = None
    try:
        conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.getenv("DB_PASSWORD", ""),
        )
        with conn:
            with conn.cursor() as cur:
                valid_ccns = load_valid_ccns(cur)
                c_rows, n_compl, skip_c = build_complication_rows(compl_raw, valid_ccns)
                r_rows, n_read, skip_r = build_readmission_rows(read_raw, valid_ccns)
                if c_rows:
                    upsert_batches(cur, c_rows)
                if r_rows:
                    upsert_batches(cur, r_rows)
    except psycopg2.Error as e:
        logger.exception("Database operation failed: %s", e)
        return 1
    finally:
        if conn is not None:
            conn.close()

    p = skip_c + skip_r
    print(
        f"Complications: {n_compl} records. Readmissions: {n_read} records. "
        f"Skipped {p} (unknown CCN)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
