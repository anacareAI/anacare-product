"""
Hospital-level search for a procedure, backed by either DB rates or JSON file data.
"""

from __future__ import annotations

from typing import Any, Optional
import os

from backend.db import is_json_mode, json_search_hospitals, haversine
from backend.network_evidence import NetworkEvidence, derive_network_status, derive_price_confidence
from backend.package_bundle import build_package_rows, ssp_code
from backend.provider_identity import ProviderProvenance, canonical_provider_id
from backend.procedure_map import resolve_episode_key
from tools.compute_episode_oop import compute_episode_oop
from tools.episode_costs import EPISODE_COSTS

_PROFILE_COLS_CACHE: Optional[dict[str, bool]] = None
RATE_CALIBRATION = float(os.getenv("RATE_CALIBRATION", "1.30"))
OUT_OF_NETWORK_RATE_MULT = float(os.getenv("OUT_OF_NETWORK_RATE_MULT", "1.18"))
OUT_OF_NETWORK_COINS_FLOOR = float(os.getenv("OUT_OF_NETWORK_COINS_FLOOR", "0.40"))


def infer_tier(cms_stars: Optional[float], rand_mult: Optional[float]) -> int:
    s = float(cms_stars) if cms_stars is not None else 3.0
    r = float(rand_mult) if rand_mult is not None else 1.8
    if s >= 4.0 and r >= 1.12:
        return 1
    if s <= 3.0 and r < 1.02:
        return 3
    return 2


def facility_system_label(name: str) -> str:
    n = (name or "").lower()
    if any(x in n for x in ("university", "academic", " mayo")):
        return "Academic (IPPS)"
    if "community" in n:
        return "Community (IPPS)"
    if "surgery center" in n or "surgical center" in n:
        return "Ambulatory Surgical Center"
    return "Independent (IPPS)"


def _plan_dict_default(
    plan_id: Optional[str] = None,
    *,
    coinsurance_pct: Optional[float] = None,
    pc_copay: Optional[float] = None,
) -> dict[str, float]:
    base = {
        "coinsurance_pct": 0.20 if coinsurance_pct is None else float(coinsurance_pct),
        "pc_copay": 0 if pc_copay is None else float(pc_copay),
        "rx_tier1": 10,
        "rx_tier2": 35,
        "rx_tier3": 70,
    }
    if not plan_id or is_json_mode():
        return base
    from backend.db import get_conn, dict_cursor
    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM plans WHERE plan_id = %s", (plan_id,))
            row = cur.fetchone()
            if row:
                pr = dict(row)
                return {
                    "coinsurance_pct": float(coinsurance_pct if coinsurance_pct is not None else (pr.get("coinsurance_pct") or 0.20)),
                    "pc_copay": float(pc_copay if pc_copay is not None else (pr.get("pc_copay") or 0)),
                    "rx_tier1": float(pr.get("rx_tier1") or 10),
                    "rx_tier2": float(pr.get("rx_tier2") or 35),
                    "rx_tier3": float(pr.get("rx_tier3") or 70),
                }
    return base


def _fetch_rates_json(procedure_id, cpt_code, user_lat, user_lng, radius_miles):
    """Fetch hospital rates from JSON data."""
    return json_search_hospitals(procedure_id, user_lat, user_lng, radius_miles)


def _fetch_rates_db(cpt_code, plan_id, cash_pay):
    """Fetch hospital rates from PostgreSQL."""
    from backend.db import get_conn, dict_cursor

    def _profile_select(cur) -> str:
        global _PROFILE_COLS_CACHE
        if _PROFILE_COLS_CACHE is None:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'hospitals'
                """
            )
            cols = {str(r["column_name"]).lower() for r in cur.fetchall()}
            _PROFILE_COLS_CACHE = {
                "address_line1": "address_line1" in cols,
                "phone": "phone" in cols,
                "website": "website" in cols,
            }
        return ", ".join(
            [
                "h.address_line1 AS address_line1" if _PROFILE_COLS_CACHE.get("address_line1") else "NULL::text AS address_line1",
                "h.phone AS phone" if _PROFILE_COLS_CACHE.get("phone") else "NULL::text AS phone",
                "h.website AS website" if _PROFILE_COLS_CACHE.get("website") else "NULL::text AS website",
            ]
        )

    with get_conn() as conn:
        with dict_cursor(conn) as cur:
            profile_select = _profile_select(cur)
            if cash_pay or not plan_id:
                cur.execute(f"""
                    SELECT h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                           h.cms_star_rating, h.rand_multiplier,
                           {profile_select},
                           AVG(r.rate) AS rate_best,
                           false AS has_plan_rate,
                           true AS has_any_rate,
                           'hospital'::text AS verification_source
                           ,NULL::text AS match_level
                           ,NULL::date AS effective_date
                           ,NULL::timestamp AS ingestion_timestamp
                           ,'rates'::text AS source_table
                    FROM hospitals h
                    JOIN affiliations a ON a.ccn = h.ccn
                    JOIN rates r ON r.npi = a.npi AND r.cpt_code = %s
                    WHERE h.lat IS NOT NULL AND h.lng IS NOT NULL
                    GROUP BY h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                             h.cms_star_rating, h.rand_multiplier
                    HAVING AVG(r.rate) > 0
                """, (cpt_code,))
            else:
                cur.execute(f"""
                    SELECT h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                           h.cms_star_rating, h.rand_multiplier,
                           {profile_select},
                           COALESCE(
                             AVG(CASE WHEN r.plan_id = %s THEN r.rate END),
                             AVG(r.rate)
                           ) AS rate_best,
                           (AVG(CASE WHEN r.plan_id = %s THEN r.rate END) IS NOT NULL) AS has_plan_rate,
                           (AVG(r.rate) IS NOT NULL) AS has_any_rate,
                           CASE
                             WHEN AVG(CASE WHEN r.plan_id = %s THEN r.rate END) IS NOT NULL THEN 'insurance'
                             ELSE 'hospital'
                           END AS verification_source,
                           CASE
                             WHEN AVG(CASE WHEN r.plan_id = %s THEN r.rate END) IS NOT NULL THEN 'exact_plan_id'
                             ELSE 'plan_fallback_any_rate'
                           END AS match_level,
                           NULL::date AS effective_date,
                           NULL::timestamp AS ingestion_timestamp,
                           'rates'::text AS source_table
                    FROM hospitals h
                    JOIN affiliations a ON a.ccn = h.ccn
                    JOIN rates r ON r.npi = a.npi AND r.cpt_code = %s
                    WHERE h.lat IS NOT NULL AND h.lng IS NOT NULL
                    GROUP BY h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                             h.cms_star_rating, h.rand_multiplier
                    HAVING COALESCE(AVG(CASE WHEN r.plan_id = %s THEN r.rate END), AVG(r.rate)) > 0
                """, (plan_id, plan_id, plan_id, plan_id, cpt_code, plan_id))
                rows = [dict(r) for r in cur.fetchall()]
                if rows:
                    return rows
                # Fallback: all rates
                cur.execute(f"""
                    SELECT h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                           h.cms_star_rating, h.rand_multiplier,
                           {profile_select},
                           AVG(r.rate) AS rate_best,
                           false AS has_plan_rate,
                           true AS has_any_rate,
                           'hospital'::text AS verification_source
                           ,'payer_only_fallback'::text AS match_level
                           ,NULL::date AS effective_date
                           ,NULL::timestamp AS ingestion_timestamp
                           ,'rates'::text AS source_table
                    FROM hospitals h
                    JOIN affiliations a ON a.ccn = h.ccn
                    JOIN rates r ON r.npi = a.npi AND r.cpt_code = %s
                    WHERE h.lat IS NOT NULL AND h.lng IS NOT NULL
                    GROUP BY h.ccn, h.name, h.city, h.state, h.zip, h.lat, h.lng,
                             h.cms_star_rating, h.rand_multiplier
                    HAVING AVG(r.rate) > 0
                """, (cpt_code,))
            return [dict(r) for r in cur.fetchall()]


def _price_position_tier(amount: float, midpoint: float) -> str:
    if midpoint <= 0:
        return "near_midpoint"
    ratio = amount / midpoint
    if ratio < 0.70:
        return "significantly_lower"
    if ratio < 0.95:
        return "slightly_lower"
    if ratio > 1.40:
        return "significantly_higher"
    if ratio > 1.05:
        return "slightly_higher"
    return "near_midpoint"


def search_hospitals_for_procedure(
    procedure_id: str,
    user_lat: float,
    user_lng: float,
    radius_miles: float,
    plan_id: Optional[str],
    cash_pay: bool,
    include_benefits: bool,
    deductible_remaining: float,
    oop_max_remaining: float,
    coinsurance_pct: Optional[float],
    pc_copay: Optional[float],
    sort_by: str,
    north: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    west: Optional[float] = None,
) -> dict[str, Any]:
    episode_key = resolve_episode_key(procedure_id)
    if not episode_key or episode_key not in EPISODE_COSTS:
        return {"error": "unknown_procedure", "detail": procedure_id}

    episode = EPISODE_COSTS[episode_key]
    cpt_code = episode["cpt_primary"]

    # Fetch hospital rates
    if is_json_mode():
        raw = _fetch_rates_json(procedure_id, cpt_code, user_lat, user_lng, radius_miles)
    else:
        raw = _fetch_rates_db(cpt_code, plan_id, cash_pay)
        # Keep search usable when DB is connected but incomplete for a CPT/market.
        if not raw:
            raw = _fetch_rates_json(procedure_id, cpt_code, user_lat, user_lng, radius_miles)

    plan_dict = _plan_dict_default(plan_id, coinsurance_pct=coinsurance_pct, pc_copay=pc_copay)

    hospitals: list[dict[str, Any]] = []
    for row in raw:
        h_lat = float(row["lat"]) if row.get("lat") is not None else None
        h_lng = float(row["lng"]) if row.get("lng") is not None else None
        if h_lat is None or h_lng is None:
            continue
        if north is not None and h_lat > north:
            continue
        if south is not None and h_lat < south:
            continue
        if east is not None and h_lng > east:
            continue
        if west is not None and h_lng < west:
            continue

        # For DB mode, compute distance; for JSON mode, it's pre-computed
        if "distance" in row:
            dist = row["distance"]
        else:
            dist = haversine(user_lat, user_lng, h_lat, h_lng)
            if radius_miles > 0 and dist > radius_miles:
                continue

        raw_neg = float(row.get("raw_rate_best", row["rate_best"]))
        neg = round(raw_neg * RATE_CALIBRATION, 2)
        cash_price = round(neg * 0.82, 2)

        stars = float(row["cms_star_rating"]) if row.get("cms_star_rating") is not None else None
        rand_m = float(row["rand_multiplier"]) if row.get("rand_multiplier") is not None else None
        tier = row.get("tier") or infer_tier(stars, rand_m)

        evidence = NetworkEvidence(
            plan_id=plan_id,
            has_plan_rate=bool(row.get("has_plan_rate")),
            has_any_rate=bool(row.get("has_any_rate", True)),
            has_oon_allowed_amount=False,
            verification_source=str(row.get("verification_source") or "hospital"),
        )
        network_status = derive_network_status(evidence)
        price_confidence = derive_price_confidence(evidence)
        match_level = str(row.get("match_level") or ("exact_plan_id" if evidence.has_plan_rate else "payer_only_fallback"))
        effective_date = row.get("effective_date")
        ingestion_timestamp = row.get("ingestion_timestamp")
        source_table = str(row.get("source_table") or "rates")

        # Out-of-network fallback behavior: apply a moderate uplift for likely billed amounts
        # and a higher coinsurance floor to avoid understating patient responsibility.
        oop_plan_dict = dict(plan_dict)
        if not cash_pay and network_status == "out_of_network":
            neg = round(neg * OUT_OF_NETWORK_RATE_MULT, 2)
            oop_plan_dict["coinsurance_pct"] = max(float(oop_plan_dict.get("coinsurance_pct", 0.20)), OUT_OF_NETWORK_COINS_FLOOR)

        estimated_oop: Optional[float] = None
        if not cash_pay and include_benefits:
            oop_result = compute_episode_oop(
                episode=episode,
                negotiated_rate=neg,
                plan=oop_plan_dict,
                deductible_remaining=deductible_remaining,
                oop_max_remaining=oop_max_remaining,
            )
            estimated_oop = float(oop_result["total_episode_oop"])

        negotiated_total = round(neg, 2)
        oop_total = round(float(estimated_oop), 2) if estimated_oop is not None else None
        display_primary = negotiated_total
        display_secondary = oop_total
        if cash_pay:
            display_primary = cash_price
            display_secondary = negotiated_total

        prov = ProviderProvenance(
            source_kind="json" if is_json_mode() else "postgres",
            source_ref=f"procedure:{procedure_id}",
            confidence=0.88 if evidence.has_plan_rate else 0.72,
        )

        hospitals.append({
            "id": row["ccn"],
            "ccn": row["ccn"],
            "lat": h_lat,
            "lng": h_lng,
            "provider_id": canonical_provider_id(
                ccn=row.get("ccn"),
                name=row.get("name") or "",
                city=row.get("city") or "",
                state=row.get("state") or "",
            ),
            "name": row["name"] or "Hospital",
            "system": facility_system_label(row["name"] or ""),
            "city": row.get("city") or "",
            "state": row.get("state") or "",
            "address_line1": row.get("address_line1") or "",
            "phone": row.get("phone") or "",
            "website": row.get("website") or "",
            "tier": tier,
            "cms_stars": int(round(stars)) if stars is not None and stars > 0 else 0,
            "cms_star_rating": stars,
            "distance": round(dist, 1),
            "rand_multiplier": round(rand_m, 2) if rand_m is not None else 1.80,
            "negotiated_rate": negotiated_total,
            "negotiated_rate_raw": round(raw_neg, 2),
            "rate_calibration_factor": RATE_CALIBRATION,
            "cash_price": cash_price,
            "estimated_oop": oop_total,
            "negotiated_rate_total": negotiated_total,
            "estimated_oop_total": oop_total,
            "display_primary": display_primary,
            "display_secondary": display_secondary,
            "display_price": display_primary,
            "network_status": network_status,
            "verification_source": evidence.verification_source,
            "price_confidence": price_confidence,
            "match_level": match_level,
            "source_provenance": {
                "table": source_table,
                "verification_source": evidence.verification_source,
                "match_level": match_level,
            },
            "effective_date": str(effective_date) if effective_date is not None else None,
            "ingestion_timestamp": str(ingestion_timestamp) if ingestion_timestamp is not None else None,
            "provenance": prov.to_dict(),
        })

    # Sort
    sort_key_map = {
        "lowest_cost": lambda h: h["display_price"],
        "top_rated": lambda h: -(h.get("cms_star_rating") or 0),
        "nearest": lambda h: h["distance"],
        "best_value": lambda h: -(h.get("_value_score", 0)),
    }

    if hospitals:
        costs = [h["display_primary"] for h in hospitals]
        min_c, max_c = min(costs), max(costs)
        span = max_c - min_c if max_c != min_c else 1.0
        for h in hospitals:
            cost_pct = (h["display_primary"] - min_c) / span
            qual = (h.get("cms_star_rating") or 3.0) / 5.0
            h["_value_score"] = 0.55 * (1 - cost_pct) + 0.45 * qual

    hospitals.sort(key=sort_key_map.get(sort_by, sort_key_map["lowest_cost"]))
    for h in hospitals:
        h.pop("_value_score", None)

    # Stats
    prices = sorted(h["display_price"] for h in hospitals)
    n = len(prices)
    median = 0.0
    if n:
        median = prices[n // 2] if n % 2 else (prices[n // 2 - 1] + prices[n // 2]) / 2

    negotiated_prices = sorted(h.get("negotiated_rate_total", 0.0) for h in hospitals)
    oop_prices = sorted((h.get("estimated_oop_total") if h.get("estimated_oop_total") is not None else h.get("display_primary", 0.0)) for h in hospitals)

    def _median(vals: list[float]) -> float:
        m = len(vals)
        if not m:
            return 0.0
        return vals[m // 2] if m % 2 else (vals[m // 2 - 1] + vals[m // 2]) / 2

    oop_median = _median(oop_prices) if include_benefits and oop_prices else 0.0
    for h in hospitals:
        h["price_position_tier"] = _price_position_tier(h["display_primary"], median)
        if include_benefits and h.get("estimated_oop_total") is not None:
            h["oop_position_tier"] = _price_position_tier(h["estimated_oop_total"], oop_median or median)
        else:
            h["oop_position_tier"] = None

    stats = {
        "lowest": prices[0] if prices else 0.0,
        "highest": prices[-1] if prices else 0.0,
        "median": median,
        "negotiated": {
            "lowest": negotiated_prices[0] if negotiated_prices else 0.0,
            "highest": negotiated_prices[-1] if negotiated_prices else 0.0,
            "median": _median(negotiated_prices),
        },
        "oop": {
            "lowest": oop_prices[0] if oop_prices else 0.0,
            "highest": oop_prices[-1] if oop_prices else 0.0,
            "median": _median(oop_prices),
        },
    }

    package_rows = build_package_rows(episode)
    return {
        "procedure_id": procedure_id,
        "procedure_name": episode["display_name"],
        "cpt_code": cpt_code,
        "episode_key": episode_key,
        "ssp_display": ssp_code(episode_key),
        "cash_pay": cash_pay,
        "include_benefits": include_benefits,
        "package_rows": package_rows,
        "clinical_summary": (
            f"{episode['display_name']} bundles the primary service (CPT {cpt_code}) with typical "
            "facility, professional, and support charges. Final cost depends on "
            "the exact services performed, your benefits, and any complications."
        ),
        "nsa_timeline": [
            {"step": 1, "title": "Compare prices", "body": "Review this estimate and nearby providers to see how bundled costs vary."},
            {"step": 2, "title": "Request a Good Faith Estimate", "body": "Call the provider's billing office and reference your CPT / package codes under the No Surprises Act."},
            {"step": 3, "title": "Bring your coverage details", "body": "Have your plan ID, deductible, and out-of-pocket status ready so they can confirm what you will owe."},
        ],
        "hospitals": hospitals,
        "stats": stats,
        "total_count": len(hospitals),
    }
