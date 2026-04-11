#!/usr/bin/env python3
"""
Phase 1: CMS Facility Affiliation (dataset 27ea-46a8) — NPI ↔ facility CCN.
Phase 2: City/state fallback for providers still without affiliations.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any
import argparse

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# Dataset 27ea-46a8 — requested pagination URL (may serve JSON or SPA HTML).
CMS_AFFILIATION_CATALOG_DATA_URL = (
    "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/"
    "facility-affiliation-data/data"
)
# JSON datastore (same dataset) when the catalog /data path does not return JSON.
CMS_AFFILIATION_DATASTORE_URL = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/27ea-46a8/0"
)
PAGE_LIMIT = 1000
INSERT_BATCH = 1000


def resolve_cms_affiliation_base(session: requests.Session) -> str:
    """Prefer catalog GET .../facility-affiliation-data/data?limit=&offset=; else datastore."""
    probe = f"{CMS_AFFILIATION_CATALOG_DATA_URL}?limit=1&offset=0"
    try:
        r = session.get(probe, timeout=60)
        r.raise_for_status()
        payload = r.json()
        if isinstance(payload, dict) and "results" in payload:
            logger.info("Using CMS catalog data URL for facility affiliation")
            return CMS_AFFILIATION_CATALOG_DATA_URL
    except (ValueError, requests.RequestException, TypeError):
        pass
    logger.info("Using CMS datastore API for facility affiliation (dataset 27ea-46a8)")
    return CMS_AFFILIATION_DATASTORE_URL


def detect_npi_ccn_keys(sample: dict[str, Any]) -> tuple[str, str]:
    """Infer JSON column names for NPI and facility CCN from the first record."""
    if not sample:
        raise ValueError("Cannot detect columns from an empty row")
    keys = list(sample.keys())
    lower_to_orig = {k.lower(): k for k in keys}

    npi_key = lower_to_orig.get("npi")
    if not npi_key:
        for lk, orig in lower_to_orig.items():
            if "npi" in lk:
                npi_key = orig
                break
    if not npi_key:
        raise ValueError(f"No NPI-like column in keys: {keys!r}")

    ccn_key = None
    for lk, orig in lower_to_orig.items():
        if "ccn" in lk:
            ccn_key = orig
            break
    if not ccn_key:
        for lk, orig in lower_to_orig.items():
            if "facility" in lk and "certification" in lk:
                ccn_key = orig
                break
    if not ccn_key:
        raise ValueError(f"No CCN-like column in keys: {keys!r}")

    return npi_key, ccn_key


def _norm_npi(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _norm_ccn(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def fetch_cms_affiliation_pages(
    session: requests.Session,
    base_url: str,
    max_pages: int = 0,
) -> tuple[list[dict[str, Any]], str, str]:
    """Paginate CMS affiliation API; return (rows, npi_key, ccn_key)."""
    offset = 0
    all_rows: list[dict[str, Any]] = []
    npi_key: str | None = None
    ccn_key: str | None = None

    while True:
        page_num = (offset // PAGE_LIMIT) + 1
        if max_pages > 0 and page_num > max_pages:
            logger.info("Reached max_pages=%s for CMS affiliation fetch", max_pages)
            break
        url = f"{base_url}?limit={PAGE_LIMIT}&offset={offset}"
        logger.info("GET %s", url)
        resp = session.get(url, timeout=120)
        resp.raise_for_status()
        payload = resp.json()
        batch = payload.get("results") or []
        if not batch:
            break
        if npi_key is None:
            npi_key, ccn_key = detect_npi_ccn_keys(batch[0])
            logger.info("Using columns npi=%r ccn=%r", npi_key, ccn_key)
        all_rows.extend(batch)
        if len(batch) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT

    if npi_key is None or ccn_key is None:
        raise ValueError("CMS affiliation API returned no rows to infer schema")
    return all_rows, npi_key, ccn_key


def load_provider_npi_set(cur: Any) -> set[str]:
    cur.execute("SELECT npi FROM providers")
    return {row[0] for row in cur.fetchall() if row[0]}


def load_hospital_ccn_set(cur: Any) -> set[str]:
    cur.execute("SELECT ccn FROM hospitals")
    return {row[0] for row in cur.fetchall() if row[0]}


def phase1_insert_cms(
    cur: Any,
    rows: list[dict[str, Any]],
    npi_key: str,
    ccn_key: str,
    valid_npis: set[str],
    valid_ccns: set[str],
) -> int:
    to_insert: list[tuple[str, str, str]] = []
    for rec in rows:
        npi = _norm_npi(rec.get(npi_key))
        ccn = _norm_ccn(rec.get(ccn_key))
        if not npi or not ccn:
            continue
        if npi not in valid_npis or ccn not in valid_ccns:
            continue
        to_insert.append((npi, ccn, "cms_affiliation"))

    total_inserted = 0
    sql = """
        INSERT INTO affiliations (npi, ccn, source)
        VALUES %s
        ON CONFLICT (npi, ccn) DO NOTHING
    """
    for i in range(0, len(to_insert), INSERT_BATCH):
        chunk = to_insert[i : i + INSERT_BATCH]
        if not chunk:
            continue
        execute_values(cur, sql, chunk, page_size=len(chunk))
        total_inserted += cur.rowcount
    return total_inserted


def count_unaffiliated_providers(cur: Any) -> int:
    cur.execute(
        """
        SELECT COUNT(*) FROM providers p
        WHERE NOT EXISTS (SELECT 1 FROM affiliations a WHERE a.npi = p.npi)
        """
    )
    row = cur.fetchone()
    return int(row[0]) if row and row[0] is not None else 0


def phase2_city_state_fallback(cur: Any) -> tuple[int, int]:
    """
    Returns (rows_inserted, P) where P is the number of providers with no affiliation
    at the start of phase 2.
    """
    cur.execute(
        """
        SELECT COUNT(*) FROM providers p
        WHERE NOT EXISTS (SELECT 1 FROM affiliations a WHERE a.npi = p.npi)
        """
    )
    row = cur.fetchone()
    p = int(row[0]) if row and row[0] is not None else 0

    cur.execute(
        """
        WITH unaffiliated AS (
            SELECT p.npi, p.city, p.state
            FROM providers p
            WHERE NOT EXISTS (SELECT 1 FROM affiliations a WHERE a.npi = p.npi)
              AND p.city IS NOT NULL AND TRIM(p.city) <> ''
              AND p.state IS NOT NULL AND TRIM(p.state) <> ''
        ),
        matches AS (
            SELECT
                u.npi,
                h.ccn,
                ROW_NUMBER() OVER (
                    PARTITION BY u.npi
                    ORDER BY
                        h.cms_star_rating DESC NULLS LAST,
                        h.name ASC NULLS LAST,
                        h.ccn ASC
                ) AS rn
            FROM unaffiliated u
            INNER JOIN hospitals h
                ON TRIM(LOWER(h.city)) = TRIM(LOWER(u.city))
               AND TRIM(UPPER(h.state)) = TRIM(UPPER(u.state))
        )
        INSERT INTO affiliations (npi, ccn, source)
        SELECT npi, ccn, 'city_state_fallback'
        FROM matches
        WHERE rn <= 3
        ON CONFLICT (npi, ccn) DO NOTHING
        """
    )
    m = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0
    return m, p


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Ingest facility affiliations into affiliations table.")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Limit CMS affiliation pagination pages (0 = all).",
    )
    args = parser.parse_args()
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        return 1

    session = requests.Session()
    session.headers.setdefault(
        "User-Agent",
        "anacare-ingest-affiliations/1.0 (+https://github.com/)",
    )

    try:
        cms_base = resolve_cms_affiliation_base(session)
        cms_rows, npi_k, ccn_k = fetch_cms_affiliation_pages(session, cms_base, max_pages=args.max_pages)
    except (requests.RequestException, ValueError, KeyError) as e:
        logger.exception("CMS affiliation fetch failed: %s", e)
        return 1

    try:
        conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.getenv("DB_PASSWORD", ""),
        )
    except psycopg2.Error as e:
        logger.exception("Database connection failed: %s", e)
        return 1

    try:
        with conn:
            with conn.cursor() as cur:
                valid_npis = load_provider_npi_set(cur)
                valid_ccns = load_hospital_ccn_set(cur)
                n = phase1_insert_cms(cur, cms_rows, npi_k, ccn_k, valid_npis, valid_ccns)
                print(f"Phase 1: {n} CMS affiliations inserted.")

                m, p = phase2_city_state_fallback(cur)
                print(
                    f"Phase 2: {m} fallback affiliations inserted for {p} unaffiliated surgeons."
                )
    except psycopg2.Error as e:
        logger.exception("Database operation failed: %s", e)
        conn.rollback()
        return 1
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
