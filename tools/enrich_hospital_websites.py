#!/usr/bin/env python3
"""
Backfill hospital website URLs in hospitals.website.

Strategy:
1) For each hospital missing website, search the web for "<name> <city> <state> hospital official site".
2) Parse the first non-aggregator result URL from DuckDuckGo HTML results.
3) Upsert into hospitals.website.

This is best-effort and should be rerun periodically.
"""

from __future__ import annotations

import os
import re
import sys
import time
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

import psycopg2
import requests
from dotenv import load_dotenv

DUCK_URL = "https://duckduckgo.com/html/"
BAD_HOSTS = {
    "facebook.com",
    "yelp.com",
    "healthgrades.com",
    "mapquest.com",
    "usnews.com",
    "wikipedia.org",
}


def _extract_result_url(href: str) -> Optional[str]:
    if not href:
        return None
    if href.startswith("//"):
        href = "https:" + href
    if href.startswith("/"):
        return None
    parsed = urlparse(href)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        q = parse_qs(parsed.query).get("uddg", [])
        if not q:
            return None
        return unquote(q[0])
    return href


def _choose_candidate(html: str) -> Optional[str]:
    links = re.findall(r'href="([^"]+)"', html)
    for raw in links:
        url = _extract_result_url(raw)
        if not url:
            continue
        p = urlparse(url)
        host = p.netloc.lower().replace("www.", "")
        if not host:
            continue
        if any(host.endswith(bad) for bad in BAD_HOSTS):
            continue
        if host.endswith(".gov") or "hospital" in host or "health" in host or "med" in host:
            return f"{p.scheme}://{p.netloc}"
    return None


def _search_website(session: requests.Session, name: str, city: str, state: str) -> Optional[str]:
    q = f"{name} {city} {state} hospital official site"
    resp = session.get(DUCK_URL, params={"q": q}, timeout=25, headers={"User-Agent": "AnaCareContactEnricher/1.0"})
    resp.raise_for_status()
    return _choose_candidate(resp.text)


def main() -> int:
    load_dotenv()
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"Missing env vars: {', '.join(missing)}")
        return 1

    conn = psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.getenv("DB_PASSWORD", ""),
    )
    updated = 0
    scanned = 0
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ccn, COALESCE(name, ''), COALESCE(city, ''), COALESCE(state, '')
                    FROM hospitals
                    WHERE website IS NULL OR website = ''
                    ORDER BY ccn
                    """
                )
                rows = cur.fetchall()
                session = requests.Session()
                for ccn, name, city, state in rows:
                    scanned += 1
                    try:
                        site = _search_website(session, name, city, state)
                    except Exception:
                        site = None
                    if site:
                        cur.execute(
                            "UPDATE hospitals SET website = %s WHERE ccn = %s",
                            (site, ccn),
                        )
                        updated += 1
                    time.sleep(0.35)
        print(f"Scanned {scanned} hospitals. Updated website for {updated}.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
