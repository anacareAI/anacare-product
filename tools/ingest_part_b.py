#!/usr/bin/env python3
"""Ingest CMS Medicare Part B Physician/Other Supplier by Provider and Service CSV."""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from collections import defaultdict
from typing import DefaultDict, Iterable, Iterator, List, Optional, Tuple

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

BATCH_SIZE = 1000
CHUNK_ROWS = 10_000
PROGRESS_INTERVAL = 500_000

CMS_PART_B_URL = (
    "https://data.cms.gov/provider-summary-by-type-of-service/"
    "medicare-physician-other-supplier/medicare-physician-other-supplier-by-provider-and-service"
)

TARGET_CPT_CODES = frozenset(
    {
        "27447",
        "27130",
        "27407",
        "23412",
        "45378",
        "63030",
        "58150",
        "47562",
        "93455",
        "73721",
    }
)

UPSERT_SQL = """
INSERT INTO surgeon_volume (npi, cpt_code, annual_volume, year)
VALUES %s
ON CONFLICT (npi, cpt_code, year)
DO UPDATE SET annual_volume = EXCLUDED.annual_volume
"""

DELETE_ORPHANS_SQL = """
DELETE FROM surgeon_volume
WHERE npi NOT IN (SELECT npi FROM providers)
"""


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ.get("DB_NAME", "anacare"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
    )


def read_row_chunks(reader: csv.reader, size: int) -> Iterator[List[List[str]]]:
    while True:
        chunk: List[List[str]] = []
        for _ in range(size):
            try:
                chunk.append(next(reader))
            except StopIteration:
                break
        if not chunk:
            break
        yield chunk


def parse_int_volume(raw: str, row_num: int, logger: logging.Logger) -> Optional[int]:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        logger.warning("Skipping invalid Tot_Srvcs at logical row %s: %r", row_num, raw)
        return None


def process_chunks(
    path: str,
    aggregates: DefaultDict[Tuple[str, str], int],
    logger: logging.Logger,
) -> int:
    """Stream CSV in CHUNK_ROWS-sized groups; return total data rows parsed (excl. header)."""
    rows_parsed = 0
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            logger.error("CSV is empty")
            return 0

        col_index = {name.strip(): i for i, name in enumerate(header)}
        required = ("Rndrng_NPI", "HCPCS_Cd", "Tot_Srvcs")
        missing = [c for c in required if c not in col_index]
        if missing:
            raise SystemExit(f"CSV missing required columns: {missing}. Found: {list(col_index.keys())}")

        i_npi = col_index["Rndrng_NPI"]
        i_cpt = col_index["HCPCS_Cd"]
        i_vol = col_index["Tot_Srvcs"]

        for chunk in read_row_chunks(reader, CHUNK_ROWS):
            for row in chunk:
                rows_parsed += 1
                if len(row) <= max(i_npi, i_cpt, i_vol):
                    continue
                cpt = (row[i_cpt] or "").strip()
                if cpt not in TARGET_CPT_CODES:
                    continue
                npi = (row[i_npi] or "").strip()
                if not npi:
                    continue
                vol = parse_int_volume(row[i_vol], rows_parsed, logger)
                if vol is None:
                    continue
                key = (npi, cpt)
                aggregates[key] += vol

            if rows_parsed > 0 and rows_parsed % PROGRESS_INTERVAL == 0:
                logger.info("Parsed %s rows...", f"{rows_parsed:,}")

    return rows_parsed


def batched(iterable: List[Tuple[str, str, int, int]], size: int) -> Iterable[List[Tuple[str, str, int, int]]]:
    for i in range(0, len(iterable), size):
        yield iterable[i : i + size]


def upsert_all(
    conn,
    aggregates: DefaultDict[Tuple[str, str], int],
    year: int,
    logger: logging.Logger,
) -> int:
    rows: List[Tuple[str, str, int, int]] = [
        (npi, cpt, vol, year) for (npi, cpt), vol in aggregates.items()
    ]
    total = 0
    with conn.cursor() as cur:
        for batch in batched(rows, BATCH_SIZE):
            execute_values(cur, UPSERT_SQL, batch, page_size=BATCH_SIZE)
            total += len(batch)
    conn.commit()
    logger.info("Upserted %s surgeon_volume rows (batched).", f"{total:,}")
    return total


def delete_orphans(conn, logger: logging.Logger) -> int:
    with conn.cursor() as cur:
        cur.execute(DELETE_ORPHANS_SQL)
        deleted = cur.rowcount
    conn.commit()
    logger.info("Deleted %s orphan surgeon_volume rows.", f"{deleted:,}")
    return deleted


def main() -> int:
    load_dotenv()
    configure_logging()
    logger = logging.getLogger(__name__)

    parser = argparse.ArgumentParser(
        description="Load CMS Part B utilization into surgeon_volume (2023 aggregates)."
    )
    parser.add_argument(
        "--file",
        dest="file",
        help="Path to pre-downloaded CMS Physician/Other Supplier by Provider and Service CSV",
    )
    args = parser.parse_args()

    if not args.file:
        print(
            f"The CMS Part B provider-by-service file is very large (~2.5GB). "
            f"Automatic download is not supported.\n\n"
            f"Download the dataset manually from:\n  {CMS_PART_B_URL}\n\n"
            f"Then run:\n  python tools/ingest_part_b.py --file /path/to/your.csv\n",
            file=sys.stderr,
        )
        return 1

    csv_path = args.file
    if not os.path.isfile(csv_path):
        logger.error("File not found: %s", csv_path)
        return 1

    aggregates: DefaultDict[Tuple[str, str], int] = defaultdict(int)
    year = 2023

    logger.info("Streaming %s ...", csv_path)
    process_chunks(csv_path, aggregates, logger)

    conn = get_connection()
    try:
        loaded = upsert_all(conn, aggregates, year, logger)
        deleted = delete_orphans(conn, logger)
    finally:
        conn.close()

    print(f"Loaded {loaded} surgeon_volume records. Deleted {deleted} orphan rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
