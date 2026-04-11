"""
Standard Service Package (SSP) line items matching Turquoise Health format.
Each row has: code, code_type, description — using real CPT, HCPCS, and Revenue codes.
"""

from __future__ import annotations
from typing import Any

from tools.episode_costs import uses_operating_room_style_charges


def build_package_rows(episode: dict[str, Any]) -> list[dict[str, str]]:
    """Build Turquoise-style package rows with real billing codes."""
    rows: list[dict[str, str]] = []
    cpt = episode["cpt_primary"]
    title = episode["display_name"]
    or_style = uses_operating_room_style_charges(episode)

    # Primary procedure — wording differs for outpatient / non-surgical vs OR-based procedures
    if or_style:
        rows.append({"code": cpt, "code_type": "CPT", "description": f"{title} — Surgeon / Professional"})
        rows.append({"code": cpt, "code_type": "CPT", "description": f"{title} — Facility / Technical"})
    else:
        rows.append({
            "code": cpt,
            "code_type": "CPT",
            "description": f"{title} — Professional fee (physician / clinician)",
        })
        rows.append({
            "code": cpt,
            "code_type": "CPT",
            "description": f"{title} — Facility & technical (equipment, suite, staff)",
        })

    # Anesthesia + OR revenue lines apply to surgical / procedural episodes only
    if or_style:
        anes_code = _anesthesia_code(cpt)
        if anes_code:
            rows.append({"code": anes_code, "code_type": "CPT", "description": "Anesthesia"})
        rows.append({"code": "0360", "code_type": "Revenue", "description": "Operating Room Services"})
        rows.append({"code": "0710", "code_type": "Revenue", "description": "Recovery Room"})
        rows.append({"code": "0250", "code_type": "Revenue", "description": "Pharmacy"})
        rows.append({"code": "0270", "code_type": "Revenue", "description": "Medical/Surgical Supplies"})

    # Pre-operative items with real codes
    for item in episode.get("preop", []):
        code = item.get("cpt") or item.get("hcpcs") or ""
        if not code or code == "rx":
            continue
        code_type = "HCPCS" if (code and not code.isdigit()) else "CPT"
        rows.append({
            "code": code,
            "code_type": code_type,
            "description": item["name"],
        })

    # Implant
    if episode.get("implant_cost") and episode["implant_cost"] > 0:
        rows.append({"code": "0278", "code_type": "Revenue", "description": "Supply/Implants — Other Implants"})

    # Post-operative items with real codes
    for item in episode.get("postop", []):
        code = item.get("cpt") or item.get("hcpcs") or ""
        if code == "rx":
            rows.append({
                "code": "0250",
                "code_type": "Revenue",
                "description": f"Pharmacy — {item['name']}",
            })
            continue
        if not code:
            continue
        code_type = "HCPCS" if (not code.isdigit()) else "CPT"
        rows.append({
            "code": code,
            "code_type": code_type,
            "description": item["name"],
        })

    return rows


def _anesthesia_code(cpt: str) -> str | None:
    """Map surgical CPT to most common anesthesia CPT code."""
    mapping = {
        "29898": "01402",  # Ankle arthroscopy
        "29881": "01382",  # Knee arthroscopy
        "29916": "01202",  # Hip arthroscopy
        "29827": "01622",  # Shoulder arthroscopy
        "26615": "01810",  # Finger fracture
        "23500": "01620",  # Clavicle
        "25600": "01830",  # Wrist
        "45378": "00810",  # Colonoscopy
        "44388": "00810",  # Colonoscopy via stoma
        "43235": "00810",  # EGD
        "49650": "00830",  # Hernia lap
        "49505": "00830",  # Hernia open
        "59510": "01961",  # Cesarean
        "59400": "01960",  # Vaginal delivery
        "58558": "00952",  # Hysteroscopy
        "58661": "00840",  # Lap ovary
        "42820": "00170",  # Tonsil child
        "42826": "00170",  # Tonsil adult
        "66984": "00142",  # Cataract
        "31622": "00520",  # Bronchoscopy
        "64721": "01810",  # Carpal tunnel
        "19081": "00400",  # Breast biopsy
        "10005": "00400",  # FNA biopsy
    }
    return mapping.get(cpt)


def ssp_code(episode_key: str) -> str:
    """Short SSP id for display."""
    ep = episode_key.replace("_", "")[:8].upper()
    return f"SSP-{ep}"
