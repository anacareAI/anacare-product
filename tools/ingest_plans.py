#!/usr/bin/env python3
"""
Load HealthCare.gov QHP Individual Market Medical landscape (plan year 2026)
into the plans table.

CSV is parsed with csv.DictReader. Use --file for a local CSV, or run without
--file to attempt an automatic download via the DKAN metastore API.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import os
import sys
import zipfile
from typing import Any, TextIO
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 1000

# QHP Landscape PY2026 Individual Medical (metastore identifier)
PY2026_LANDSCAPE_DATASET_ID = "6fe7fb77-7291-4104-952f-7c7e2c5d0c45"
METASTORE_ITEM_URL = (
    "https://data.healthcare.gov/api/1/metastore/schemas/dataset/items/"
    + PY2026_LANDSCAPE_DATASET_ID
)
ABOUT_PAGE_URL = (
    "https://data.healthcare.gov/dataset/QHP-Landscape-Individual-Market-Medical"
    "/fyem-wfcp/about_data"
)


def _print_manual_download_instructions(extra: str | None = None) -> None:
    if extra:
        print(extra, file=sys.stderr)
    print(
        "Manual download:\n"
        f"  1) Open: {ABOUT_PAGE_URL}\n"
        "  2) Download the PY2026 Individual Market Medical data file "
        "(ZIP with spreadsheet).\n"
        "  3) Open the workbook in Excel or LibreOffice and save the data sheet "
        "as CSV (UTF-8).\n"
        f"  4) Run: python {sys.argv[0]} --file /path/to/your_export.csv\n",
        file=sys.stderr,
    )


def _http_get_bytes(url: str, timeout: int = 120) -> bytes:
    req = Request(url, headers={"User-Agent": "anacare-ingest-plans/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _fetch_csv_download_url() -> str | None:
    try:
        raw = _http_get_bytes(METASTORE_ITEM_URL, timeout=60)
    except (HTTPError, URLError, TimeoutError, OSError) as e:
        logger.warning("Metastore request failed: %s", e)
        return None
    try:
        meta = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        logger.warning("Invalid metastore JSON: %s", e)
        return None
    dist = meta.get("distribution") or []
    for d in dist:
        url = d.get("downloadURL")
        if isinstance(url, str) and url.startswith("http"):
            return url
    return None


def _pick_csv_from_zip(zf: zipfile.ZipFile) -> tuple[str, bytes] | None:
    names = [n for n in zf.namelist() if not n.endswith("/")]
    csv_names = [n for n in names if n.lower().endswith(".csv")]
    if not csv_names:
        return None
    csv_names.sort(key=lambda n: zf.getinfo(n).file_size, reverse=True)
    chosen = csv_names[0]
    return chosen, zf.read(chosen)


def _prepare_csv_stream_from_download(url: str) -> TextIO | None:
    try:
        blob = _http_get_bytes(url)
    except (HTTPError, URLError, TimeoutError, OSError) as e:
        logger.warning("Download failed: %s", e)
        _print_manual_download_instructions(f"Download error: {e}")
        return None

    lower = url.lower()
    if lower.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            picked = _pick_csv_from_zip(zf)
            if picked is None:
                xlsx = [n for n in zf.namelist() if n.lower().endswith(".xlsx")]
                if xlsx:
                    _print_manual_download_instructions(
                        "The official PY2026 archive contains an XLSX file, not CSV. "
                        "Export the sheet to CSV, then pass --file."
                    )
                else:
                    _print_manual_download_instructions(
                        "No CSV found inside the downloaded ZIP."
                    )
                return None
            _name, data = picked
            logger.info("Using CSV from zip: %s", _name)
            return io.TextIOWrapper(io.BytesIO(data), encoding="utf-8", newline="")

    if lower.endswith(".csv"):
        return io.TextIOWrapper(io.BytesIO(blob), encoding="utf-8", errors="replace")

    _print_manual_download_instructions(
        f"Unexpected download format (not .zip or .csv): {url}"
    )
    return None


def _open_csv_source(path: str | None) -> TextIO | None:
    if path:
        return open(path, newline="", encoding="utf-8", errors="replace")

    dl_url = _fetch_csv_download_url()
    if not dl_url:
        _print_manual_download_instructions(
            "Could not resolve a download URL from the metastore API."
        )
        return None
    logger.info("Download URL: %s", dl_url)
    return _prepare_csv_stream_from_download(dl_url)


def _norm_header(h: str) -> str:
    return " ".join(h.strip().lower().split())


def _find_column(fieldnames: list[str], exact: str) -> str | None:
    for fn in fieldnames:
        if fn.strip() == exact:
            return fn
    return None


def _find_column_fuzzy(
    fieldnames: list[str],
    required_substrings: tuple[str, ...],
) -> str | None:
    for fn in fieldnames:
        n = _norm_header(fn)
        if all(s in n for s in required_substrings):
            return fn
    return None


def _resolve_money_columns(fieldnames: list[str]) -> dict[str, str | None]:
    """Map logical keys to actual CSV header names."""
    fset = list(fieldnames)
    out: dict[str, str | None] = {}

    out["plan_id"] = _find_column(fset, "Plan ID (Standard Component)") or _find_column_fuzzy(
        fset,
        ("plan", "id", "standard", "component"),
    )
    out["plan_name"] = _find_column(fset, "Plan Marketing Name") or _find_column_fuzzy(
        fset,
        ("plan", "marketing", "name"),
    )
    out["payer"] = _find_column(fset, "Issuer Name") or _find_column_fuzzy(
        fset,
        ("issuer", "name"),
    )
    out["metal_tier"] = _find_column(fset, "Metal Level")
    out["network_type"] = _find_column(fset, "Plan Type")
    out["state"] = _find_column(fset, "State Code")

    out["deductible_ind"] = _find_column(
        fset, "Individual Medical Deductible (In-Network, Standard)"
    ) or _find_column_fuzzy(
        fset,
        ("individual", "medical", "deductible", "in-network", "standard"),
    )
    out["deductible_fam"] = _find_column(
        fset, "Family Medical Deductible (In-Network, Standard)"
    ) or _find_column_fuzzy(
        fset,
        ("family", "medical", "deductible", "in-network", "standard"),
    )
    out["oop_max_ind"] = _find_column(
        fset, "Individual Medical MOOP (In-Network, Standard)"
    ) or _find_column_fuzzy(
        fset,
        ("individual", "medical", "moop", "in-network", "standard"),
    ) or _find_column_fuzzy(
        fset,
        ("individual", "medical", "maximum", "out-of-pocket", "in-network", "standard"),
    )
    out["oop_max_fam"] = _find_column(
        fset, "Family Medical MOOP (In-Network, Standard)"
    ) or _find_column_fuzzy(
        fset,
        ("family", "medical", "moop", "in-network", "standard"),
    ) or _find_column_fuzzy(
        fset,
        ("family", "medical", "maximum", "out-of-pocket", "in-network", "standard"),
    )
    return out


def _parse_money(raw: Any) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.upper() == "N/A":
        return None
    cleaned = s.replace("$", "").replace(",", "").strip()
    if not cleaned or cleaned.upper() == "N/A":
        return None
    try:
        return float(cleaned)
    except ValueError:
        logger.warning("Unparseable money value: %r", raw)
        return None


def _parse_text(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.upper() == "N/A":
        return None
    return s


def _row_to_tuple(
    row: dict[str, str],
    cols: dict[str, str | None],
) -> tuple[Any, ...] | None:
    def g(key: str) -> Any:
        h = cols.get(key)
        if not h:
            return None
        return row.get(h)

    plan_id = _parse_text(g("plan_id"))
    if not plan_id:
        return None

    return (
        plan_id,
        _parse_text(g("plan_name")),
        _parse_text(g("payer")),
        _parse_text(g("metal_tier")),
        _parse_text(g("network_type")),
        _parse_text(g("state")),
        _parse_money(g("deductible_ind")),
        _parse_money(g("deductible_fam")),
        _parse_money(g("oop_max_ind")),
        _parse_money(g("oop_max_fam")),
        None,  # coinsurance_pct
        None,  # pc_copay
        None,  # specialist_copay
        None,  # er_copay
        None,  # uc_copay
        None,  # rx_tier1
        None,  # rx_tier2
        None,  # rx_tier3
    )


def _upsert_batches(cur: Any, rows: list[tuple[Any, ...]]) -> None:
    sql = """
        INSERT INTO plans (
            plan_id, plan_name, payer, metal_tier, network_type, state,
            deductible_ind, deductible_fam, oop_max_ind, oop_max_fam,
            coinsurance_pct, pc_copay, specialist_copay, er_copay, uc_copay,
            rx_tier1, rx_tier2, rx_tier3
        ) VALUES %s
        ON CONFLICT (plan_id) DO UPDATE SET
            plan_name = EXCLUDED.plan_name,
            payer = EXCLUDED.payer,
            metal_tier = EXCLUDED.metal_tier,
            network_type = EXCLUDED.network_type,
            state = EXCLUDED.state,
            deductible_ind = EXCLUDED.deductible_ind,
            deductible_fam = EXCLUDED.deductible_fam,
            oop_max_ind = EXCLUDED.oop_max_ind,
            oop_max_fam = EXCLUDED.oop_max_fam,
            coinsurance_pct = EXCLUDED.coinsurance_pct,
            pc_copay = EXCLUDED.pc_copay,
            specialist_copay = EXCLUDED.specialist_copay,
            er_copay = EXCLUDED.er_copay,
            uc_copay = EXCLUDED.uc_copay,
            rx_tier1 = EXCLUDED.rx_tier1,
            rx_tier2 = EXCLUDED.rx_tier2,
            rx_tier3 = EXCLUDED.rx_tier3
    """
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        execute_values(cur, sql, chunk, page_size=BATCH_SIZE)


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Ingest HealthCare.gov QHP landscape CSV into plans."
    )
    parser.add_argument(
        "--file",
        dest="file",
        metavar="PATH",
        help="Path to a pre-downloaded/exported CSV (optional).",
    )
    args = parser.parse_args()

    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        return 1

    stream = _open_csv_source(args.file)
    if stream is None:
        return 1

    try:
        reader = csv.DictReader(stream)
        fieldnames = reader.fieldnames
        if not fieldnames:
            logger.error("CSV has no header row.")
            return 1

        cols = _resolve_money_columns(fieldnames)
        if not cols.get("plan_id"):
            logger.error(
                "Could not find plan id column. Headers sample: %s",
                fieldnames[:12],
            )
            return 1

        db_rows: list[tuple[Any, ...]] = []
        states: set[str] = set()
        for row in reader:
            tup = _row_to_tuple(row, cols)
            if tup is None:
                continue
            db_rows.append(tup)
            st = tup[5]
            if st:
                states.add(st)

        n = len(db_rows)
        s = len(states)
        if n == 0:
            logger.warning("No plan rows to insert.")
            print(f"Loaded {n} plans across {s} states.")
            return 0

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
                    _upsert_batches(cur, db_rows)
        except psycopg2.Error as e:
            logger.exception("Database operation failed: %s", e)
            conn.rollback()
            return 1
        finally:
            conn.close()

        print(f"Loaded {n} plans across {s} states.")
        return 0
    finally:
        stream.close()


if __name__ == "__main__":
    sys.exit(main())
