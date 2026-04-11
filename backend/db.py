"""
backend/db.py

Database abstraction layer.
Falls back to JSON file data when PostgreSQL is not available.
"""

import json
import logging
import math
import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

_pool = None
_json_data = None
_using_json = False
REQUIRED_TABLES = ("hospitals", "zipcodes", "plans")

DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data"
TIER_ADJ = {1: 1.10, 2: 1.00, 3: 0.88}
RATE_CALIBRATION = float(os.getenv("RATE_CALIBRATION", "1.30"))


def _load_json_data():
    global _json_data
    if _json_data is not None:
        return _json_data

    log.info("Loading JSON file data (no PostgreSQL)")
    with open(DATA_DIR / "hospitals.json") as f:
        hospitals = json.load(f)
    with open(DATA_DIR / "basePrices.json") as f:
        base_prices = json.load(f)

    _json_data = {"hospitals": hospitals, "base_prices": base_prices}
    log.info(f"Loaded {len(hospitals)} hospitals, {len(base_prices)} procedure prices")
    return _json_data


def init_pool(min_conn: int = 2, max_conn: int = 10):
    global _pool, _using_json

    db_host = os.environ.get("DB_HOST")
    if not db_host:
        log.info("No DB_HOST configured — using JSON file backend")
        _using_json = True
        _load_json_data()
        return

    try:
        import psycopg2
        import psycopg2.pool

        password = os.environ.get("DB_PASSWORD", "")
        _pool = psycopg2.pool.ThreadedConnectionPool(
            min_conn, max_conn,
            host=db_host,
            port=int(os.getenv("DB_PORT", "5432")),
            dbname=os.environ.get("DB_NAME", "anacare"),
            user=os.environ.get("DB_USER", "anacare"),
            password=password or None,
            sslmode="require" if password else "prefer",
            connect_timeout=10,
        )
        # Validate core app tables exist; otherwise fall back to JSON data.
        conn = _pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = ANY(%s)
                    """,
                    (list(REQUIRED_TABLES),),
                )
                found = {row[0] for row in cur.fetchall()}
        finally:
            _pool.putconn(conn)
        missing = [t for t in REQUIRED_TABLES if t not in found]
        if missing:
            log.warning(
                "PostgreSQL connected but missing tables %s; falling back to JSON backend",
                ",".join(missing),
            )
            _pool.closeall()
            _pool = None
            _using_json = True
            _load_json_data()
            return

        log.info("PostgreSQL connection pool initialized")
    except Exception as e:
        log.warning(f"PostgreSQL not available ({e}), falling back to JSON")
        _using_json = True
        _load_json_data()


def is_json_mode():
    return _using_json or _pool is None


@contextmanager
def get_conn():
    if _pool is None:
        raise RuntimeError("No database pool — use is_json_mode() to check first")
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


def dict_cursor(conn):
    import psycopg2.extras
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ── JSON-backed helpers ──────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def json_search_hospitals(procedure_id, user_lat, user_lng, radius_miles):
    """Return hospital rows for a procedure within radius using JSON data."""
    data = _load_json_data()
    bp = data["base_prices"].get(procedure_id)
    if not bp:
        return []

    results = []
    for h in data["hospitals"]:
        if procedure_id not in h.get("procedures", []):
            continue
        lat, lng = h.get("lat"), h.get("lng")
        if lat is None or lng is None:
            continue

        dist = haversine(user_lat, user_lng, lat, lng)
        if radius_miles > 0 and dist > radius_miles:
            continue

        rand_adj = h.get("rand_multiplier", 1.80) / 1.80
        tier_adj = TIER_ADJ.get(h.get("tier", 2), 1.0)
        m = rand_adj * tier_adj

        results.append({
            "ccn": h.get("ccn") or h.get("id", ""),
            "name": h.get("name", ""),
            "city": h.get("city", ""),
            "state": h.get("state", ""),
            "zip": "",
            "address_line1": h.get("address_line1", ""),
            "phone": h.get("phone", ""),
            "website": h.get("website", ""),
            "lat": lat,
            "lng": lng,
            "cms_star_rating": h.get("cms_stars") or 0,
            "rand_multiplier": h.get("rand_multiplier", 1.80),
            "raw_rate_best": round(bp["negotiated"] * m, 2),
            # Keep raw rate uncalibrated; calibration is applied once downstream.
            "rate_best": round(bp["negotiated"] * m, 2),
            "distance": round(dist, 1),
            "tier": h.get("tier", 2),
        })

    return results
