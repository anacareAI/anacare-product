"""
load_rates_db.py

Upserts rate records from .tmp/raw_rates.jsonl into PostgreSQL.

Usage:
    python tools/load_rates_db.py [--init-schema]
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

TMP_DIR = Path(".tmp")
RATES_PATH = TMP_DIR / "raw_rates.jsonl"
SCHEMA_PATH = Path("schema/001_base.sql")
SCHEMA_CONSUMER_PATH = Path("schema/002_consumer_platform.sql")

BATCH_SIZE = 500


def get_connection():
    password = os.environ.get("DB_PASSWORD", "")
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=password or None,
        connect_timeout=15,
        sslmode="require" if password else "prefer",
    )


def init_schema(conn):
    for path in [SCHEMA_PATH, SCHEMA_CONSUMER_PATH]:
        if path.exists():
            log.info(f"Running schema from {path}")
            with open(path) as f:
                sql = f.read()
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
    log.info("Schema initialized")


def load_rates(conn) -> tuple[int, int]:
    if not RATES_PATH.exists():
        log.error(f"{RATES_PATH} not found. Run stream_mrf_file.py first.")
        sys.exit(1)

    affiliations_map = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT npi, ccn FROM affiliations")
            for row in cur.fetchall():
                affiliations_map.setdefault(row[0], []).append(row[1])
    except Exception:
        conn.rollback()
        log.warning("affiliations table not available — skipping affiliation matching")

    started_at = datetime.now(tz=timezone.utc).replace(tzinfo=None)
    inserted = 0
    matched_affiliations = 0
    batch = []

    with open(RATES_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)

            npi = r["npi"]
            if npi in affiliations_map:
                matched_affiliations += 1

            batch.append((
                r["npi"], r.get("plan_id"), r["cpt_code"], r["rate"],
                r["rate_type"], r.get("billing_class"), r.get("expiration_date") or None,
                r.get("rate_flag"), r.get("source_file"),
            ))

            if len(batch) >= BATCH_SIZE:
                _flush_batch(conn, batch)
                inserted += len(batch)
                batch = []

                if inserted % (BATCH_SIZE * 20) == 0:
                    log.info(f"  Progress: {inserted:,} records")

    if batch:
        _flush_batch(conn, batch)
        inserted += len(batch)

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO ingestion_log (source_file, payer, records_written, started_at) VALUES (%s, %s, %s, %s)",
            ("mrf_pipeline", "aetna", inserted, started_at),
        )
    conn.commit()

    log.info(f"Rates upserted: {inserted:,}. Affiliation-matched: {matched_affiliations:,}")
    return inserted, matched_affiliations


def _flush_batch(conn, batch):
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO rates (npi, plan_id, cpt_code, rate, rate_type,
                               billing_class, expiration_date, rate_flag, source_file)
            VALUES %s
            ON CONFLICT (npi, cpt_code, rate_type, billing_class) DO UPDATE SET
                rate=EXCLUDED.rate,
                source_file=EXCLUDED.source_file,
                ingested_at=NOW()
            """,
            batch,
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--init-schema", action="store_true")
    args = parser.parse_args()

    log.info("=== AnaCare: Load Rates to DB ===")

    try:
        conn = get_connection()
        log.info("DB connection established")
    except psycopg2.OperationalError as e:
        log.error(f"DB connection failed: {e}")
        sys.exit(1)

    if args.init_schema:
        init_schema(conn)
        if not RATES_PATH.exists():
            log.info("Schema created. No rate data to load yet.")
            conn.close()
            return

    inserted, matched = load_rates(conn)
    conn.close()
    log.info(f"=== Done: {inserted:,} rates loaded, {matched:,} affiliation-matched ===")


if __name__ == "__main__":
    main()
