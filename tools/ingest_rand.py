#!/usr/bin/env python3
"""Ingest RAND RRA1144-2 hospital-level supplemental CSV into hospitals.rand_multiplier."""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
from typing import Iterable, Optional

import psycopg2
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

SUFFIXES = (
    " hospital",
    " medical center",
    " health system",
    " llc",
)


def normalize_name(value: str) -> str:
    if not value:
        return ""
    s = value.lower().strip()
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def normalize_state(value: str) -> str:
    if not value:
        return ""
    return value.strip().upper()


def strip_suffixes(normalized: str) -> str:
    n = normalized
    changed = True
    while changed:
        changed = False
        for suf in SUFFIXES:
            if n.endswith(suf):
                n = n[: -len(suf)].strip()
                changed = True
                break
    return n


def detect_columns(headers: list[str]) -> tuple[int, int, int]:
    """Return indices for (ratio_col, name_col, state_col)."""
    lowered = [h.strip().lower() for h in headers]

    ratio_idx: Optional[int] = None
    for i, h in enumerate(lowered):
        if "price" in h and ("ratio" in h or "multiplier" in h):
            ratio_idx = i
            break
    if ratio_idx is None:
        raise ValueError(
            "Could not find a column containing 'price' and ('ratio' or 'multiplier'). "
            f"Headers: {headers!r}"
        )

    name_idx: Optional[int] = None
    for i, h in enumerate(lowered):
        if "name" in h and ("hospital" in h or "facility" in h):
            name_idx = i
            break
    if name_idx is None:
        for i, h in enumerate(lowered):
            if h in ("hospital_name", "facility_name", "provider_name"):
                name_idx = i
                break
    if name_idx is None:
        for i, h in enumerate(lowered):
            if "name" in h and "state" not in h:
                name_idx = i
                break
    if name_idx is None:
        raise ValueError(f"Could not infer hospital name column. Headers: {headers!r}")

    state_idx: Optional[int] = None
    for i, h in enumerate(lowered):
        if h == "state" or h.endswith(" state") or h == "st":
            if "zip" in h:
                continue
            state_idx = i
            break
    if state_idx is None:
        for i, h in enumerate(lowered):
            if h == "state_abbr" or "state_code" in h:
                state_idx = i
                break
    if state_idx is None:
        raise ValueError(f"Could not infer state column. Headers: {headers!r}")

    return ratio_idx, name_idx, state_idx


def parse_ratio(raw: str) -> Optional[float]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("", "na", "n/a", ".", "null", "none"):
        return None
    s = s.replace("%", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        logger.warning("Could not parse ratio value %r; skipping row", raw)
        return None


def load_hospitals(conn: psycopg2.extensions.connection) -> list[tuple[str, str, str]]:
    """Rows: (ccn, name, state)."""
    with conn.cursor() as cur:
        cur.execute("SELECT ccn, COALESCE(name, ''), COALESCE(state, '') FROM hospitals")
        return [(str(r[0]), str(r[1]), str(r[2])) for r in cur.fetchall()]


def build_lookups(
    rows: Iterable[tuple[str, str, str]],
) -> tuple[dict[str, list[tuple[str, str]]], dict[tuple[str, str], list[str]]]:
    """exact_by_name[norm_name] -> [(ccn, norm_state), ...]; frag (fragment, state) -> ccns."""
    exact_by_name: dict[str, list[tuple[str, str]]] = {}
    frag: dict[tuple[str, str], list[str]] = {}
    for ccn, name, state in rows:
        nn = normalize_name(name)
        ns = normalize_state(state)
        if nn:
            exact_by_name.setdefault(nn, []).append((ccn, ns))
            fn = strip_suffixes(nn)
            if fn:
                frag.setdefault((fn, ns), []).append(ccn)
    return exact_by_name, frag


def match_ccns(
    rand_name: str,
    rand_state: str,
    exact_by_name: dict[str, list[tuple[str, str]]],
    frag: dict[tuple[str, str], list[str]],
) -> list[str]:
    rn = normalize_name(rand_name)
    rs = normalize_state(rand_state)
    if not rn:
        return []

    if rn in exact_by_name:
        pairs = exact_by_name[rn]
        if rs:
            filt = [c for c, st in pairs if st == rs]
            if filt:
                return filt
        elif len(pairs) == 1:
            return [pairs[0][0]]

    rf = strip_suffixes(rn)
    if rf and rs:
        fk = (rf, rs)
        if fk in frag:
            return list(frag[fk])

    return []


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest RAND hospital-level CSV into hospitals.rand_multiplier."
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Local path to RAND RRA1144-2 supplemental hospital-level CSV.",
    )
    args = parser.parse_args()

    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )
    try:
        hospitals = load_hospitals(conn)
        exact_by_name, frag_map = build_lookups(hospitals)

        with open(args.file, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = next(reader)
            r_i, n_i, s_i = detect_columns(headers)

            m = 0
            n_matched_rows = 0
            updates: list[tuple[float, str]] = []

            for row in reader:
                if not row or all(not (c or "").strip() for c in row):
                    continue

                def col(i: int) -> str:
                    return row[i].strip() if i < len(row) else ""

                name = col(n_i)
                state = col(s_i)
                if not name:
                    continue

                m += 1
                ccns = match_ccns(name, state, exact_by_name, frag_map)
                ratio = parse_ratio(col(r_i))
                if not ccns or ratio is None:
                    continue

                n_matched_rows += 1
                for ccn in ccns:
                    updates.append((ratio, ccn))

            with conn.cursor() as cur:
                for ratio, ccn in updates:
                    cur.execute(
                        "UPDATE hospitals SET rand_multiplier = %s WHERE ccn = %s",
                        (ratio, ccn),
                    )
            conn.commit()

        p = m - n_matched_rows
        print(f"Matched {n_matched_rows} of {m} RAND hospitals. Unmatched: {p}.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
