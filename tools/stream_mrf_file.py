"""
stream_mrf_file.py

Streams a single Aetna MRF in-network JSON file using ijson (never loads into memory).
Filters to target CPT codes and writes matching rate records to .tmp/raw_rates.jsonl.

For unknown provider NPIs, inserts a minimal stub into the providers table so that
rate records can be inserted even before NPPES ingestion.

Usage:
    python tools/stream_mrf_file.py --url <mrf_url>
    python tools/stream_mrf_file.py --links .tmp/aetna_mrf_links.json
"""

import argparse
import gzip
import json
import logging
import os
import sys
import time
from pathlib import Path

import ijson
import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

TARGET_CPT_CODES = {
    "27447", "27130", "27407", "23412", "45378",
    "63030", "58150", "47562", "93455", "73721",
}

TMP_DIR = Path(".tmp")
OUTPUT_PATH = TMP_DIR / "raw_rates.jsonl"

MAX_RETRIES = 5
BACKOFF_BASE = 2
REQUEST_TIMEOUT = 120
LOG_INTERVAL = 100_000


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


def ensure_provider_stub(conn, npi: str, known_npis: set) -> None:
    if npi in known_npis:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO providers (npi, npi_resolved) VALUES (%s, FALSE) ON CONFLICT DO NOTHING",
                (npi,),
            )
        conn.commit()
        known_npis.add(npi)
    except Exception:
        conn.rollback()


def open_stream(url: str):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.info(f"Opening stream: {url} (attempt {attempt})")
            resp = requests.get(
                url,
                stream=True,
                timeout=REQUEST_TIMEOUT,
                headers={"User-Agent": "AnaCare-MRF-Streamer/0.1 (contact@anacare.ai)"},
            )
            if resp.status_code == 200:
                return resp
            if resp.status_code == 404:
                log.error(f"404 Not Found: {url}")
                sys.exit(1)
            if resp.status_code == 429 or resp.status_code >= 500:
                wait = BACKOFF_BASE ** attempt
                log.warning(f"HTTP {resp.status_code} — retrying in {wait}s")
                time.sleep(wait)
                continue
            resp.raise_for_status()
        except (requests.ConnectionError, requests.Timeout) as e:
            wait = BACKOFF_BASE ** attempt
            log.warning(f"{e} — retrying in {wait}s")
            time.sleep(wait)
    log.error(f"All {MAX_RETRIES} attempts failed for {url}")
    sys.exit(1)


def stream_rates(resp, source_url: str, out_file, conn, known_npis: set, max_records: int = 0) -> int:
    written = 0
    parsed = 0
    skipped_cpt = 0
    stubs_created = 0

    raw = resp.raw
    raw.decode_content = True
    if source_url.endswith(".gz"):
        log.info("Detected gzipped stream — decompressing on the fly")
        raw = gzip.GzipFile(fileobj=raw)

    try:
        for item in ijson.items(raw, "in_network.item"):
            parsed += 1
            if parsed % LOG_INTERVAL == 0:
                log.info(f"  Parsed {parsed:,} entries, {written:,} written, {skipped_cpt:,} skipped")

            billing_code = str(item.get("billing_code", "")).strip()
            billing_code_type = item.get("billing_code_type", "").upper()

            if billing_code_type != "CPT" or billing_code not in TARGET_CPT_CODES:
                skipped_cpt += 1
                continue

            description = item.get("description", "")
            negotiated_rates = item.get("negotiated_rates", [])

            for rate_group in negotiated_rates:
                provider_groups = rate_group.get("provider_groups", [])
                negotiated_prices = rate_group.get("negotiated_prices", [])

                npis = []
                for pg in provider_groups:
                    npis.extend(str(n) for n in pg.get("npi", []))

                for price in negotiated_prices:
                    negotiated_rate = price.get("negotiated_rate")
                    negotiated_type = price.get("negotiated_type", "")
                    expiration_date = price.get("expiration_date", "")
                    billing_class = price.get("billing_class", "")

                    rate_type = {
                        "negotiated": "fee_for_service",
                        "fee schedule": "fee_for_service",
                        "case rate": "case_rate",
                        "capitation": "capitation",
                        "percent of total charges": "percent_of_charges",
                        "per diem": "per_diem",
                        "other": "other",
                    }.get(negotiated_type.lower(), negotiated_type.lower() or "unknown")

                    for npi in npis:
                        if npi not in known_npis:
                            ensure_provider_stub(conn, npi, known_npis)
                            stubs_created += 1

                        record = {
                            "npi": npi,
                            "cpt_code": billing_code,
                            "description": description,
                            "rate": negotiated_rate,
                            "rate_type": rate_type,
                            "billing_class": billing_class,
                            "expiration_date": expiration_date,
                            "source_file": source_url,
                        }
                        out_file.write(json.dumps(record) + "\n")
                        written += 1

                        if max_records > 0 and written >= max_records:
                            log.info(f"Reached max_records={max_records}, stopping early")
                            return written

    except ijson.JSONError as e:
        log.error(f"ijson parse error at entry {parsed}: {e}")
        log.warning("Partial results written. File may be malformed.")

    log.info(f"Stream complete: {parsed:,} parsed, {written:,} written, {skipped_cpt:,} skipped, {stubs_created} provider stubs created")
    return written


def process_url(url: str, conn, known_npis: set, append: bool = False, max_records: int = 0) -> int:
    TMP_DIR.mkdir(exist_ok=True)
    mode = "a" if append else "w"
    resp = open_stream(url)
    content_length = resp.headers.get("Content-Length")
    if content_length:
        log.info(f"File size: {int(content_length) / 1024 / 1024:.0f} MB")
    else:
        log.info("File size unknown (no Content-Length header)")

    log.info(f"Target CPT codes: {sorted(TARGET_CPT_CODES)}")
    log.info(f"Writing to: {OUTPUT_PATH} (mode={mode})")

    with open(OUTPUT_PATH, mode) as f:
        count = stream_rates(resp, url, f, conn, known_npis, max_records=max_records)
    return count


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", help="Direct URL of a single MRF in-network file")
    group.add_argument("--links", help="Path to .tmp/aetna_mrf_links.json")
    parser.add_argument("--append", action="store_true")
    parser.add_argument("--max-records", type=int, default=0)
    args = parser.parse_args()

    log.info("=== AnaCare: Stream MRF File ===")

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT npi FROM providers")
        known_npis = {row[0] for row in cur.fetchall()}
    log.info(f"Loaded {len(known_npis)} known NPIs from providers table")

    if args.url:
        count = process_url(args.url, conn, known_npis, append=args.append, max_records=args.max_records)
        log.info(f"Total records written: {count:,}")
    else:
        with open(args.links) as f:
            links = json.load(f)
        log.info(f"Processing {len(links)} MRF file(s) from {args.links}")
        total = 0
        remaining = args.max_records
        for i, link in enumerate(links, 1):
            url = link["location"]
            desc = link.get("description", url)
            log.info(f"\n[{i}/{len(links)}] {desc}")
            count = process_url(url, conn, known_npis, append=(i > 1 or args.append), max_records=remaining)
            total += count
            log.info(f"Running total: {total:,} records")
            if args.max_records > 0:
                remaining = args.max_records - total
                if remaining <= 0:
                    log.info("Global max_records reached, stopping.")
                    break

        log.info(f"\n=== Done: {total:,} total rate records written to {OUTPUT_PATH} ===")

    conn.close()
    log.info("Next step: python tools/load_rates_db.py")


if __name__ == "__main__":
    main()
