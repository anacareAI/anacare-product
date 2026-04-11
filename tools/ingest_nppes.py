#!/usr/bin/env python3
"""
Download (or use a local) NPPES monthly full-replacement ZIP, stream-parse the
provider CSV, filter surgical individual providers, and upsert into providers.
"""

from __future__ import annotations

import argparse
import csv
import io
import logging
import os
import re
import sys
import tempfile
import zipfile
from datetime import date, datetime
from typing import Any, Iterator
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

NPI_FILES_PAGE = "https://download.cms.gov/nppes/NPI_Files.html"
NPPES_BASE = "https://download.cms.gov/nppes/"

SURGICAL_TAXONOMIES = frozenset(
    {
        "207X00000X",
        "208G00000X",
        "208600000X",
        "207V00000X",
        "208800000X",
        "207T00000X",
        "207RG0100X",
        "207L00000X",
        "207W00000X",
    }
)

TAXONOMY_TO_SPECIALTY: dict[str, str] = {
    "207X00000X": "Orthopedic Surgery",
    "208G00000X": "Cardiac Surgery",
    "208600000X": "General Surgery",
    "207V00000X": "OB/GYN",
    "208800000X": "Urology",
    "207T00000X": "Neurosurgery",
    "207RG0100X": "Gastroenterology",
    "207L00000X": "Anesthesiology",
    "207W00000X": "Ophthalmology",
}

PROGRESS_INTERVAL = 500_000
CHUNK_SIZE = 10_000

UPSERT_SQL = """
    INSERT INTO providers (
        npi, name, entity_type, specialty, taxonomy_code,
        city, state, zip, credentials, npi_enum_date
    ) VALUES %s
    ON CONFLICT (npi) DO UPDATE SET
        name = EXCLUDED.name,
        entity_type = EXCLUDED.entity_type,
        specialty = EXCLUDED.specialty,
        taxonomy_code = EXCLUDED.taxonomy_code,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip = EXCLUDED.zip,
        credentials = EXCLUDED.credentials,
        npi_enum_date = EXCLUDED.npi_enum_date,
        last_synced = NOW()
"""


def _iter_zip_anchor_links(html: str) -> Iterator[tuple[str, str, str]]:
    """Yield (href, aria_label, inner_text) for simple <a>...</a> tags."""
    for m in re.finditer(r"<a\s+([^>]+)>([^<]*)</a>", html, flags=re.I):
        attrs, inner = m.group(1), m.group(2)
        hm = re.search(r"""href=['"]([^'"]+)['"]""", attrs, flags=re.I)
        if not hm:
            continue
        href = hm.group(1).strip()
        am = re.search(r"""aria-label=['"]([^'"]*)['"]""", attrs, flags=re.I)
        aria = am.group(1).strip() if am else ""
        yield href, aria, inner.strip()


def _parse_date_in_parens(aria_or_text: str) -> datetime | None:
    m = re.search(r"\(([^)]+\d{4})\)", aria_or_text)
    if not m:
        return None
    inner = m.group(1).strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(inner, fmt)
        except ValueError:
            continue
    return None


def _parse_date_from_month_year_href(href: str) -> datetime | None:
    m = re.search(r"_([A-Za-z]+)_(\d{4})_V2\.zip\s*$", href, flags=re.I)
    if not m:
        return None
    mon, yr = m.group(1), m.group(2)
    for fmt in ("%B %Y", "%b %Y"):
        try:
            return datetime.strptime(f"{mon} {yr}", fmt)
        except ValueError:
            continue
    return None


def find_latest_full_replacement_monthly_zip_url(html: str) -> str:
    """
    Prefer links whose text/aria mentions Full Replacement Monthly NPI File.
    Otherwise use the newest NPPES_Data_Dissemination_*_V2.zip that is not
    weekly or deactivation.
    """
    candidates: list[tuple[str, datetime]] = []
    legacy: list[tuple[str, datetime]] = []

    for href, aria, inner in _iter_zip_anchor_links(html):
        if not href.lower().endswith(".zip"):
            continue
        path_lower = href.lower()
        if "deactivated" in path_lower or "weekly" in path_lower:
            continue

        label = f"{aria} {inner}".lower()
        abs_url = urljoin(NPPES_BASE, href.lstrip("./"))

        dt = _parse_date_in_parens(aria) or _parse_date_in_parens(inner)
        if not dt:
            dt = _parse_date_from_month_year_href(href)

        if "full replacement" in label and "monthly" in label and "npi" in label:
            legacy.append((abs_url, dt or datetime.min))
            continue

        if re.search(
            r"NPPES_Data_Dissemination_[A-Za-z]+_\d{4}_V2\.zip\s*$",
            href,
            flags=re.I,
        ):
            candidates.append((abs_url, dt or datetime.min))

    pool = legacy if legacy else candidates
    if not pool:
        raise RuntimeError(
            "Could not find Full Replacement Monthly NPI File or monthly "
            "NPPES_Data_Dissemination_*_V2.zip on the CMS download page."
        )

    pool.sort(key=lambda x: x[1], reverse=True)
    return pool[0][0]


def download_zip(url: str, dest_path: str) -> None:
    logger.info("Downloading %s", url)
    req = Request(url, headers={"User-Agent": "anacare-nppes-ingest/1.0"})
    with urlopen(req) as resp, open(dest_path, "wb") as out:
        while True:
            block = resp.read(8 * 1024 * 1024)
            if not block:
                break
            out.write(block)
    logger.info("Saved ZIP to %s", dest_path)


def pick_npidata_pfile_csv(zf: zipfile.ZipFile) -> str:
    for name in zf.namelist():
        if not name.lower().endswith(".csv"):
            continue
        base = os.path.basename(name).lower()
        if "npidata" in base and "pfile" in base:
            return name
    raise FileNotFoundError("No npidata_pfile CSV found inside NPPES ZIP")


def header_index_map(header: list[str]) -> dict[str, int]:
    def norm(s: str) -> str:
        return "".join(ch.lower() for ch in s if ch.isalnum())

    out: dict[str, int] = {}
    for i, raw in enumerate(header):
        name = raw.strip().lstrip("\ufeff")
        out[name] = i
        out[norm(name)] = i
    return out


def col_idx(cmap: dict[str, int], name: str) -> int:
    try:
        return cmap[name]
    except KeyError as e:
        norm_name = "".join(ch.lower() for ch in name if ch.isalnum())
        if norm_name in cmap:
            return cmap[norm_name]
        raise KeyError(f"Missing required CSV column: {name!r}") from e


def parse_npi_enum_date(raw: str) -> date | None:
    s = (raw or "").strip()
    if not s:
        return None
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            try:
                mo, da, yr = (int(parts[0]), int(parts[1]), int(parts[2]))
                return date(yr, mo, da)
            except ValueError:
                return None
    if len(s) == 8 and s.isdigit():
        try:
            return date(int(s[4:8]), int(s[0:2]), int(s[2:4]))
        except ValueError:
            try:
                return date(int(s[0:4]), int(s[4:6]), int(s[6:8]))
            except ValueError:
                return None
    return None


def row_to_tuple(
    row: list[str],
    cmap: dict[str, int],
) -> tuple[Any, ...] | None:
    def g(name: str) -> str:
        i = col_idx(cmap, name)
        if i >= len(row):
            return ""
        return row[i].strip()

    def g_any(*names: str) -> str:
        for n in names:
            try:
                return g(n)
            except KeyError:
                continue
        return ""

    if g_any("Entity_Type_Code", "Entity Type Code") != "1":
        return None
    tax = g_any(
        "Provider_Taxonomy_Code_1",
        "Provider Taxonomy Code_1",
        "Healthcare_Provider_Taxonomy_Code_1",
        "Healthcare Provider Taxonomy Code_1",
    )
    if tax not in SURGICAL_TAXONOMIES:
        return None
    if g_any("NPI_Deactivation_Date", "NPI Deactivation Date"):
        return None

    npi = g_any("NPI")
    if not npi:
        return None

    last = g_any("Provider_Last_Name_Legal_Name", "Provider Last Name (Legal Name)")
    first = g_any("Provider_First_Name", "Provider First Name")
    name_s = f"{last}, {first}" if last or first else ""

    postal = g_any(
        "Provider_Business_Practice_Location_Address_Postal_Code",
        "Provider Business Practice Location Address Postal Code",
    )
    zip5 = postal[:5] if postal else None

    cred = g_any("Provider_Credential_Text", "Provider Credential Text") or None
    city = g_any(
        "Provider_Business_Practice_Location_Address_City_Name",
        "Provider Business Practice Location Address City Name",
    ) or None
    state = g_any(
        "Provider_Business_Practice_Location_Address_State_Name",
        "Provider Business Practice Location Address State Name",
    ) or None

    enum_d = parse_npi_enum_date(g_any("NPI_Enumeration_Date", "NPI Enumeration Date"))

    return (
        npi,
        name_s or None,
        "NPI-1",
        TAXONOMY_TO_SPECIALTY[tax],
        tax,
        city,
        state,
        zip5,
        cred,
        enum_d,
    )


def ensure_provider_columns(cur: Any) -> None:
    cur.execute(
        "ALTER TABLE providers ADD COLUMN IF NOT EXISTS credentials TEXT;"
    )
    cur.execute(
        "ALTER TABLE providers ADD COLUMN IF NOT EXISTS npi_enum_date DATE;"
    )


def flush_batch(cur: Any, batch: list[tuple[Any, ...]]) -> None:
    if not batch:
        return
    execute_values(
        cur,
        UPSERT_SQL,
        batch,
        page_size=len(batch),
    )


def ingest_zip_csv(
    zip_path: str,
    conn: Any,
) -> int:
    surgical_written = 0
    rows_parsed = 0
    batch: list[tuple[Any, ...]] = []

    with zipfile.ZipFile(zip_path, "r") as zf:
        member = pick_npidata_pfile_csv(zf)
        logger.info("Reading CSV member: %s", member)
        with zf.open(member, "r") as raw:
            text_io = io.TextIOWrapper(
                raw,
                encoding="utf-8-sig",
                newline="",
            )
            reader = csv.reader(text_io)
            try:
                header = next(reader)
            except StopIteration:
                raise RuntimeError("Empty NPPES CSV") from None

            cmap = header_index_map(header)

            while True:
                chunk: list[list[str]] = []
                for _ in range(CHUNK_SIZE):
                    try:
                        chunk.append(next(reader))
                    except StopIteration:
                        break
                if not chunk:
                    break

                for row in chunk:
                    rows_parsed += 1
                    if rows_parsed % PROGRESS_INTERVAL == 0:
                        logger.info(
                            "Parsed %s CSV rows; %s surgical rows queued/written",
                            rows_parsed,
                            surgical_written + len(batch),
                        )

                    try:
                        tup = row_to_tuple(row, cmap)
                    except KeyError:
                        raise
                    except Exception:
                        logger.exception("Bad row at parse count %s", rows_parsed)
                        raise

                    if tup is None:
                        continue
                    batch.append(tup)
                    if len(batch) >= CHUNK_SIZE:
                        with conn.cursor() as cur:
                            flush_batch(cur, batch)
                        surgical_written += len(batch)
                        batch.clear()

            if batch:
                with conn.cursor() as cur:
                    flush_batch(cur, batch)
                surgical_written += len(batch)

    return surgical_written


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Ingest NPPES into providers.")
    parser.add_argument(
        "--file",
        dest="zip_file",
        metavar="PATH",
        help="Path to a pre-downloaded NPPES monthly ZIP",
    )
    args = parser.parse_args()

    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        return 1

    zip_path = args.zip_file
    tmp_path: str | None = None
    try:
        if not zip_path:
            html_req = Request(
                NPI_FILES_PAGE,
                headers={"User-Agent": "anacare-nppes-ingest/1.0"},
            )
            with urlopen(html_req) as r:
                html = r.read().decode("latin-1", errors="replace")

            zip_url = find_latest_full_replacement_monthly_zip_url(html)
            fd, tmp_path = tempfile.mkstemp(suffix=".zip", prefix="nppes_")
            os.close(fd)
            download_zip(zip_url, tmp_path)
            zip_path = tmp_path

        conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.getenv("DB_PASSWORD", ""),
        )
        try:
            with conn:
                with conn.cursor() as cur:
                    ensure_provider_columns(cur)
                surgical_count = ingest_zip_csv(zip_path, conn)
        finally:
            conn.close()

    except Exception:
        logger.exception("NPPES ingest failed")
        return 1
    finally:
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                logger.warning("Could not remove temp ZIP %s", tmp_path)

    print(f"Loaded {surgical_count} surgical providers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
