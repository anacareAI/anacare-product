"""
backend/main.py

FastAPI backend for AnaCare consumer platform.
Works with PostgreSQL when available, falls back to JSON file data.
"""

import logging
import math
import os
import sys
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import init_pool, is_json_mode, json_search_hospitals
from backend.hospital_search_service import search_hospitals_for_procedure
from tools.episode_costs import EPISODE_COSTS
from tools.compute_episode_oop import compute_episode_oop

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="AnaCare API", version="2.0.0", redirect_slashes=False)

origins = [
    "https://www.anacare.ai",
    "https://anacare.ai",
    # Vite default
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Local dev: any port (5174, 3000, etc.) and IPv6 loopback — used if the browser talks to
    # :8000 directly (e.g. VITE_API_BASE_URL=http://127.0.0.1:8000 without proxy).
    allow_origin_regex=r"https://.*\.vercel\.app$|^http://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CPT_TO_PROC = {ep["cpt_primary"]: key for key, ep in EPISODE_COSTS.items()}

_PROCEDURE_SEARCH_ROWS: list | None = None


def _build_procedure_search_rows() -> list[dict]:
    """Frontend procedure ids with display names and CPT codes from EPISODE_COSTS."""
    from backend.procedure_map import FRONTEND_PROCEDURE_TO_EPISODE_KEY

    out: list[dict] = []
    for fid, ek in FRONTEND_PROCEDURE_TO_EPISODE_KEY.items():
        ep = EPISODE_COSTS.get(ek)
        if not ep:
            continue
        name = ep.get("display_name") or fid
        cpt_primary = (ep.get("cpt_primary") or "").strip()
        extra: set[str] = set()
        for phase in ("preop", "postop"):
            for item in ep.get(phase) or []:
                for k in ("cpt", "hcpcs"):
                    v = item.get(k)
                    if isinstance(v, str) and v and v.lower() != "rx":
                        extra.add(v.lower())
        if cpt_primary:
            extra.add(cpt_primary.lower())
        hay = " ".join([fid.lower(), name.lower(), cpt_primary.lower(), " ".join(sorted(extra))])
        out.append({
            "id": fid,
            "name": name,
            "cpt_primary": cpt_primary or None,
            "episode_key": ek,
            "_hay": hay,
        })
    return out


def _get_procedure_search_rows() -> list[dict]:
    global _PROCEDURE_SEARCH_ROWS
    if _PROCEDURE_SEARCH_ROWS is None:
        _PROCEDURE_SEARCH_ROWS = _build_procedure_search_rows()
    return _PROCEDURE_SEARCH_ROWS


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "AnaCare API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.on_event("startup")
def startup():
    init_pool()
    mode = "JSON file" if is_json_mode() else "PostgreSQL"
    log.info(f"AnaCare API started (backend: {mode})")


@app.get("/health")
def health():
    if is_json_mode():
        return {"status": "ok", "db": "json_file_backend"}
    try:
        from backend.db import get_conn
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok", "db": "postgresql"}
    except Exception as e:
        return {"status": "error", "db": str(e)}


@app.get("/hospitals")
def get_hospitals():
    if is_json_mode():
        from backend.db import _load_json_data
        data = _load_json_data()
        rows = [{
            "ccn": h.get("ccn") or h.get("id"),
            "name": h["name"],
            "city": h.get("city", ""),
            "state": h.get("state", ""),
            "lat": h.get("lat"),
            "lng": h.get("lng"),
            "cms_star_rating": h.get("cms_stars", 0),
            "rand_multiplier": h.get("rand_multiplier", 1.80),
        } for h in data["hospitals"] if h.get("lat") and h.get("lng")]
        return {"hospitals": rows, "total": len(rows)}

    from backend.db import get_conn, dict_cursor
    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("""
                SELECT ccn, name, city, state, zip, lat, lng,
                       cms_star_rating, rand_multiplier
                FROM hospitals WHERE lat IS NOT NULL ORDER BY cms_star_rating DESC NULLS LAST
            """)
            rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        for key in ("lat", "lng", "cms_star_rating", "rand_multiplier"):
            if row.get(key) is not None:
                row[key] = float(row[key])
    return {"hospitals": rows, "total": len(rows)}


@app.get("/zipcodes/nearest")
def nearest_zipcode(
    lat: float = Query(..., description="Latitude (WGS84)"),
    lng: float = Query(..., description="Longitude (WGS84)"),
):
    """Return the closest US ZIP (and centroid) to a lat/lng — used for browser geolocation."""
    if is_json_mode():
        import json
        import urllib.parse
        import urllib.request

        try:
            q = urllib.parse.urlencode(
                {"format": "json", "lat": lat, "lon": lng, "addressdetails": "1", "countrycodes": "us"}
            )
            url = f"https://nominatim.openstreetmap.org/reverse?{q}"
            req = urllib.request.Request(url, headers={"User-Agent": "AnaCare/1.0 (https://anacare.ai)"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            addr = data.get("address") or {}
            postcode = (addr.get("postcode") or "").strip()
            if "-" in postcode:
                postcode = postcode.split("-")[0].strip()
            if len(postcode) != 5 or not postcode.isdigit():
                raise HTTPException(status_code=404, detail="Could not resolve ZIP from coordinates")
            # Normalize via zippopotam for city/state + centroid
            zurl = f"https://api.zippopotam.us/us/{postcode}"
            zreq = urllib.request.Request(zurl, headers={"User-Agent": "AnaCare/1.0"})
            with urllib.request.urlopen(zreq, timeout=5) as zresp:
                zdata = json.loads(zresp.read().decode())
            place = zdata.get("places", [{}])[0]
            return {
                "zip": postcode,
                "city": place.get("place name", ""),
                "state": (place.get("state abbreviation") or "").upper(),
                "lat": float(place.get("latitude", lat)),
                "lng": float(place.get("longitude", lng)),
            }
        except HTTPException:
            raise
        except Exception as e:
            log.warning("nearest_zipcode (json mode): %s", e)
            raise HTTPException(status_code=404, detail="Could not resolve ZIP near coordinates")

    from backend.db import get_conn, dict_cursor

    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT zip, city, state, lat, lng,
                  (3959 * acos(LEAST(1.0, GREATEST(-1.0,
                    cos(radians(%s)) * cos(radians(lat)) * cos(radians(lng) - radians(%s))
                    + sin(radians(%s)) * sin(radians(lat))
                  )))) AS dist_mi
                FROM zipcodes
                WHERE lat IS NOT NULL AND lng IS NOT NULL
                ORDER BY dist_mi
                LIMIT 1
                """,
                (lat, lng, lat),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No ZIP near coordinates")
    return {
        "zip": row["zip"],
        "city": row["city"] or "",
        "state": (row["state"] or "").upper(),
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
    }


@app.get("/v2/places/search")
def places_search_v2(
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(8, ge=1, le=15),
):
    """US city/place autocomplete via Nominatim (server-side; browser cannot send required User-Agent)."""
    import json
    import urllib.parse
    import urllib.request

    query = q.strip()
    if len(query) < 2:
        return {"results": []}

    params = urllib.parse.urlencode(
        {
            "q": f"{query}, United States",
            "format": "json",
            "limit": str(limit),
            "addressdetails": "1",
            "countrycodes": "us",
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "AnaCare/1.0 (https://anacare.ai)"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read().decode())
    except Exception as e:
        log.warning("places_search_v2: %s", e)
        raise HTTPException(status_code=502, detail="Place search is temporarily unavailable")

    if not isinstance(rows, list):
        return {"results": []}

    out = []
    seen = set()
    for r in rows:
        addr = r.get("address") or {}
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("hamlet")
            or ""
        )
        state = (addr.get("state") or "").strip()
        try:
            lat = float(r["lat"])
            lng = float(r["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not city and not state:
            continue
        label = ", ".join(x for x in (city, state) if x)
        if not label:
            continue
        key = (round(lat, 3), round(lng, 3), label.lower())
        if key in seen:
            continue
        seen.add(key)

        postcode = (addr.get("postcode") or "").strip()
        if ";" in postcode:
            postcode = postcode.split(";")[0].strip()
        if "-" in postcode:
            postcode = postcode.split("-")[0].strip()
        zip_guess = postcode if len(postcode) == 5 and postcode.isdigit() else None

        out.append(
            {
                "label": label,
                "lat": lat,
                "lng": lng,
                "city": city,
                "state": state,
                "zip": zip_guess,
            }
        )

    return {"results": out}


@app.get("/zipcodes/{zip_code}")
def get_zipcode(zip_code: str):
    if is_json_mode():
        # Use zippopotam.us as fallback
        import urllib.request, json
        try:
            url = f"https://api.zippopotam.us/us/{zip_code}"
            req = urllib.request.Request(url, headers={"User-Agent": "AnaCare/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                place = data.get("places", [{}])[0]
                return {
                    "zip": zip_code,
                    "city": place.get("place name", ""),
                    "state": place.get("state abbreviation", ""),
                    "lat": float(place.get("latitude", 0)),
                    "lng": float(place.get("longitude", 0)),
                }
        except Exception:
            raise HTTPException(status_code=404, detail="ZIP code not found")

    from backend.db import get_conn, dict_cursor
    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT zip, city, state, lat, lng FROM zipcodes WHERE zip = %s", (zip_code,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="ZIP code not found")
    return dict(row)


@app.get("/v2/procedures/search")
def procedures_search_v2(
    q: str = Query("", description="Substring match on name, procedure id, or CPT / HCPCS codes"),
    limit: int = Query(15, ge=1, le=50),
):
    qn = (q or "").strip().lower()
    if len(qn) < 1:
        return {"results": []}

    rows = _get_procedure_search_rows()
    scored: list[tuple[int, str, dict]] = []
    for r in rows:
        hay = r["_hay"]
        if qn not in hay:
            continue
        name_l = r["name"].lower()
        cpt = (r.get("cpt_primary") or "").lower()
        rid = r["id"].lower()
        if cpt and (cpt == qn or cpt.startswith(qn)):
            rank = 0
        elif name_l.startswith(qn):
            rank = 1
        elif qn in name_l:
            rank = 2
        elif rid.startswith(qn) or qn in rid:
            rank = 3
        elif cpt and qn in cpt:
            rank = 4
        else:
            rank = 5
        scored.append((rank, r["name"].lower(), r))

    scored.sort(key=lambda x: (x[0], x[1]))
    results = []
    for _, _, r in scored[:limit]:
        results.append({
            "id": r["id"],
            "name": r["name"],
            "cpt_primary": r["cpt_primary"],
            "episode_key": r["episode_key"],
        })
    return {"results": results}


@app.get("/plans")
def get_plans():
    if is_json_mode():
        return {"payers": []}

    from backend.db import get_conn, dict_cursor
    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT plan_id, plan_name, payer, metal_tier, network_type, state FROM plans ORDER BY payer, plan_name")
            rows = [dict(r) for r in cur.fetchall()]
    payer_map = {}
    for row in rows:
        payer = row["payer"] or "Unknown"
        payer_map.setdefault(payer, []).append(row)
    return {"payers": [{"payer_name": k, "plans": v} for k, v in payer_map.items()]}


class HospitalSearchRequest(BaseModel):
    procedure_id: str
    zip: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_miles: float = 50.0
    plan_id: Optional[str] = None
    cash_pay: bool = False
    include_benefits: bool = False
    deductible_remaining: float = 0
    oop_max_remaining: float = 99999
    coinsurance_pct: Optional[float] = None
    pc_copay: Optional[float] = None
    sort_by: str = "lowest_cost"
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None


class HospitalSearchV2Request(BaseModel):
    procedure_id: str
    zip: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_miles: float = 50.0
    plan_id: Optional[str] = None
    cash_pay: bool = False
    benefits_opt_in: bool = False
    deductible_remaining: float = 0
    oop_max_remaining: float = 99999
    coinsurance_pct: Optional[float] = None
    pc_copay: Optional[float] = None
    sort_by: str = "lowest_cost"
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None


@app.post("/search/hospitals")
def search_hospitals(req: HospitalSearchRequest):
    user_lat = req.lat
    user_lng = req.lng

    if user_lat is None or user_lng is None:
        if is_json_mode():
            # Geocode via zippopotam
            import urllib.request, json
            try:
                url = f"https://api.zippopotam.us/us/{req.zip}"
                r = urllib.request.Request(url, headers={"User-Agent": "AnaCare/1.0"})
                with urllib.request.urlopen(r, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    place = data.get("places", [{}])[0]
                    user_lat = float(place.get("latitude", 0))
                    user_lng = float(place.get("longitude", 0))
            except Exception:
                raise HTTPException(status_code=404, detail="ZIP code not found")
        else:
            from backend.db import get_conn, dict_cursor
            with get_conn() as conn:
                with dict_cursor(conn) as cur:
                    cur.execute("SELECT lat, lng FROM zipcodes WHERE zip = %s", (req.zip,))
                    zip_row = cur.fetchone()
            if not zip_row or not zip_row["lat"]:
                raise HTTPException(status_code=404, detail="ZIP code not found")
            user_lat = float(zip_row["lat"])
            user_lng = float(zip_row["lng"])

    result = search_hospitals_for_procedure(
        procedure_id=req.procedure_id,
        user_lat=user_lat,
        user_lng=user_lng,
        radius_miles=req.radius_miles,
        plan_id=req.plan_id,
        cash_pay=req.cash_pay,
        include_benefits=req.include_benefits,
        deductible_remaining=req.deductible_remaining,
        oop_max_remaining=req.oop_max_remaining,
        coinsurance_pct=req.coinsurance_pct,
        pc_copay=req.pc_copay,
        sort_by=req.sort_by,
        north=req.north,
        south=req.south,
        east=req.east,
        west=req.west,
    )

    if result.get("error") == "unknown_procedure":
        raise HTTPException(status_code=404, detail=f"No episode mapping for: {result.get('detail')}")

    return result


@app.post("/v2/search/hospitals")
def search_hospitals_v2(req: HospitalSearchV2Request):
    base_req = HospitalSearchRequest(
        procedure_id=req.procedure_id,
        zip=req.zip,
        lat=req.lat,
        lng=req.lng,
        radius_miles=req.radius_miles,
        plan_id=req.plan_id,
        cash_pay=req.cash_pay,
        include_benefits=req.benefits_opt_in,
        deductible_remaining=req.deductible_remaining,
        oop_max_remaining=req.oop_max_remaining,
        coinsurance_pct=req.coinsurance_pct,
        pc_copay=req.pc_copay,
        sort_by=req.sort_by,
        north=req.north,
        south=req.south,
        east=req.east,
        west=req.west,
    )
    resp = search_hospitals(base_req)
    resp["api_version"] = "v2"
    return resp


@app.get("/providers/{ccn}/episode")
def get_episode(
    ccn: str,
    cpt_code: str = Query(...),
    plan_id: Optional[str] = None,
    deductible: float = 0,
    oop_max: float = 99999,
):
    proc_key = CPT_TO_PROC.get(cpt_code)
    if not proc_key:
        raise HTTPException(status_code=404, detail=f"No episode data for CPT {cpt_code}")

    episode = EPISODE_COSTS[proc_key]
    plan_dict = {"coinsurance_pct": 0.20, "pc_copay": 0, "rx_tier1": 10, "rx_tier2": 35, "rx_tier3": 70}

    if is_json_mode():
        # Use base price as negotiated rate for this hospital
        from backend.db import _load_json_data
        data = _load_json_data()
        bp = data["base_prices"].get(next(
            (pid for pid, ek in __import__('backend.procedure_map', fromlist=['FRONTEND_PROCEDURE_TO_EPISODE_KEY']).FRONTEND_PROCEDURE_TO_EPISODE_KEY.items() if ek == proc_key),
            ""
        ))
        hosp = next((h for h in data["hospitals"] if (h.get("ccn") or h.get("id")) == ccn), None)
        if not hosp or not bp:
            raise HTTPException(status_code=404, detail="No rate found")
        rand_adj = hosp.get("rand_multiplier", 1.80) / 1.80
        tier_adj = {1: 1.10, 2: 1.00, 3: 0.88}.get(hosp.get("tier", 2), 1.0)
        negotiated_rate = round(bp["negotiated"] * rand_adj * tier_adj)
    else:
        from backend.db import get_conn, dict_cursor
        with get_conn() as conn:
            with dict_cursor(conn) as cur:
                cur.execute("""
                    SELECT r.rate FROM rates r
                    JOIN affiliations a ON a.npi = r.npi AND a.ccn = %s
                    WHERE r.cpt_code = %s ORDER BY r.rate ASC LIMIT 1
                """, (ccn, cpt_code))
                rate_row = cur.fetchone()
        if not rate_row:
            raise HTTPException(status_code=404, detail="No negotiated rate found")
        negotiated_rate = float(rate_row["rate"])

        if plan_id:
            from backend.db import get_conn as gc2, dict_cursor as dc2
            with gc2() as conn:
                with dc2(conn) as cur:
                    cur.execute("SELECT * FROM plans WHERE plan_id = %s", (plan_id,))
                    plan_row = cur.fetchone()
                    if plan_row:
                        pr = dict(plan_row)
                        plan_dict = {
                            "coinsurance_pct": float(pr.get("coinsurance_pct") or 0.20),
                            "pc_copay": float(pr.get("pc_copay") or 0),
                            "rx_tier1": float(pr.get("rx_tier1") or 10),
                            "rx_tier2": float(pr.get("rx_tier2") or 35),
                            "rx_tier3": float(pr.get("rx_tier3") or 70),
                        }

    base_result = compute_episode_oop(
        episode=episode,
        negotiated_rate=negotiated_rate,
        plan=plan_dict,
        deductible_remaining=deductible,
        oop_max_remaining=oop_max,
    )

    return {
        "ccn": ccn,
        "cpt_code": cpt_code,
        "negotiated_rate": negotiated_rate,
        "episode": base_result,
        "complication_episode": None,
        "complication_rate": None,
        "complication_national_avg": None,
    }


@app.get("/v2/providers/{ccn}/episode")
def get_episode_v2(
    ccn: str,
    cpt_code: str = Query(...),
    plan_id: Optional[str] = None,
    benefits_opt_in: bool = False,
    deductible_remaining: float = 0,
    oop_max_remaining: float = 99999,
):
    base = get_episode(
        ccn=ccn,
        cpt_code=cpt_code,
        plan_id=plan_id,
        deductible=deductible_remaining if benefits_opt_in else 0,
        oop_max=oop_max_remaining if benefits_opt_in else 99999,
    )
    base["api_version"] = "v2"
    base["benefits_opt_in"] = benefits_opt_in
    return base


@app.get("/v2/plans/{plan_id}/benefits")
def get_plan_benefits(plan_id: str):
    if is_json_mode():
        return {
            "plan_id": plan_id,
            "plan_name": "Default Plan Template",
            "payer": "Unknown",
            "network_type": "Unknown",
            "benefit_template": {
                "deductible": 2000.0,
                "oop_max": 6500.0,
                "coinsurance_pct": 0.20,
                "pc_copay": 0.0,
                "specialist_copay": 0.0,
                "er_copay": 0.0,
                "uc_copay": 0.0,
            },
        }
    from backend.db import get_conn, dict_cursor
    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT plan_id, plan_name, payer, network_type,
                       COALESCE(deductible_ind, 0) AS deductible,
                       COALESCE(oop_max_ind, 99999) AS oop_max,
                       COALESCE(coinsurance_pct, 0.20) AS coinsurance_pct,
                       COALESCE(pc_copay, 0) AS pc_copay,
                       COALESCE(specialist_copay, 0) AS specialist_copay,
                       COALESCE(er_copay, 0) AS er_copay,
                       COALESCE(uc_copay, 0) AS uc_copay
                FROM plans
                WHERE plan_id = %s
                """,
                (plan_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Plan not found: {plan_id}")
    return {
        "plan_id": row["plan_id"],
        "plan_name": row["plan_name"],
        "payer": row["payer"],
        "network_type": row["network_type"],
        "benefit_template": {
            "deductible": float(row["deductible"] or 0),
            "oop_max": float(row["oop_max"] or 99999),
            "coinsurance_pct": float(row["coinsurance_pct"] or 0.20),
            "pc_copay": float(row["pc_copay"] or 0),
            "specialist_copay": float(row["specialist_copay"] or 0),
            "er_copay": float(row["er_copay"] or 0),
            "uc_copay": float(row["uc_copay"] or 0),
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
