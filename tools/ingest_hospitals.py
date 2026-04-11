#!/usr/bin/env python3
"""
Download CMS Hospital General Information (xubh-q36u) and upsert into hospitals.
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

CMS_BASE = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0"
)
PAGE_LIMIT = 1000
BATCH_SIZE = 500


def _get_ccn(record: dict[str, Any]) -> str | None:
    v = record.get("provider_ccn") or record.get("facility_id")
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _get_name(record: dict[str, Any]) -> str | None:
    v = record.get("hospital_name") or record.get("facility_name")
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _get_city(record: dict[str, Any]) -> str | None:
    v = record.get("city") or record.get("citytown")
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _normalize_zip(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return s[:5]


def _parse_star_rating(raw: Any) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() == "not available":
        return None
    try:
        return float(s)
    except ValueError:
        logger.warning("Unparseable hospital_overall_rating: %r", raw)
        return None


def _record_to_row(
    record: dict[str, Any],
) -> tuple[str, str | None, str | None, str | None, str | None, float | None, str | None, str | None] | None:
    ccn = _get_ccn(record)
    if not ccn:
        logger.warning("Skipping record without provider_ccn/facility_id: %s", record)
        return None
    name = _get_name(record)
    city = _get_city(record)
    state = record.get("state")
    state_s = str(state).strip() if state is not None else None
    zip_val = _normalize_zip(record.get("zip_code"))
    rating = _parse_star_rating(record.get("hospital_overall_rating"))
    address_line1 = (
        record.get("address")
        or record.get("address_line_1")
        or record.get("street_address")
        or record.get("location_address")
    )
    phone = (
        record.get("phone_number")
        or record.get("telephone_number")
        or record.get("provider_phone_number")
    )
    addr_s = str(address_line1).strip() if address_line1 is not None else None
    phone_s = str(phone).strip() if phone is not None else None
    return (ccn, name, city, state_s, zip_val, rating, addr_s, phone_s)


def fetch_all_results() -> list[dict[str, Any]]:
    offset = 0
    all_rows: list[dict[str, Any]] = []
    session = requests.Session()
    while True:
        url = f"{CMS_BASE}?limit={PAGE_LIMIT}&offset={offset}"
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


def upsert_batches(cur: Any, rows: list[tuple[Any, ...]]) -> None:
    sql = """
        INSERT INTO hospitals (ccn, name, city, state, zip, cms_star_rating, address_line1, phone)
        VALUES %s
        ON CONFLICT (ccn) DO UPDATE SET
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip = EXCLUDED.zip,
            cms_star_rating = EXCLUDED.cms_star_rating,
            address_line1 = EXCLUDED.address_line1,
            phone = EXCLUDED.phone
    """
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        execute_values(cur, sql, chunk, page_size=BATCH_SIZE)


def main() -> int:
    load_dotenv()
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        return 1

    try:
        raw_records = fetch_all_results()
    except Exception:
        return 1

    db_rows: list[tuple[Any, ...]] = []
    for rec in raw_records:
        row = _record_to_row(rec)
        if row:
            db_rows.append(row)

    n = len(db_rows)
    if n == 0:
        logger.warning("No valid hospital rows to insert")
        print("Inserted/updated 0 hospitals, 0 had no zip match.")
        return 0

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
                upsert_batches(cur, db_rows)
                cur.execute(
                    """
                    UPDATE hospitals h
                    SET lat = z.lat, lng = z.lng
                    FROM zipcodes z
                    WHERE h.zip = z.zip AND h.lat IS NULL
                    """
                )
                cur.execute("SAVEPOINT hospitals_geom_sp")
                try:
                    cur.execute(
                        """
                        UPDATE hospitals
                        SET geom = ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)
                        WHERE lat IS NOT NULL AND geom IS NULL
                        """
                    )
                except psycopg2.Error as e:
                    logger.warning("Skipping hospital geom update (PostGIS unavailable): %s", e)
                    cur.execute("ROLLBACK TO SAVEPOINT hospitals_geom_sp")
                cur.execute(
                    """
                    SELECT COUNT(*) FROM hospitals
                    WHERE zip IS NOT NULL AND lat IS NULL
                    """
                )
                row = cur.fetchone()
                no_match = int(row[0]) if row and row[0] is not None else 0
    except psycopg2.Error as e:
        logger.exception("Database operation failed: %s", e)
        return 1
    finally:
        if conn is not None:
            conn.close()

    print(f"Inserted/updated {n} hospitals, {no_match} had no zip match.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
