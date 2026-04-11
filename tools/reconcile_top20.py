#!/usr/bin/env python3
"""
Generate a focused reconciliation report for the top 20 highest-gap procedure+zip
pairs using parity_summary.csv.

Output:
  tests/parity/reports/anacare_vs_benchmark_top20.md
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARITY_CSV = ROOT / "tests" / "parity" / "reports" / "parity_summary.csv"
OUT_MD = ROOT / "tests" / "parity" / "reports" / "anacare_vs_benchmark_top20.md"


def _to_float(v: str) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def main() -> int:
    if not PARITY_CSV.exists():
        raise FileNotFoundError(f"Missing parity summary: {PARITY_CSV}")

    rows: list[dict[str, str]] = []
    with PARITY_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    for r in rows:
        provider = _to_float(r.get("provider_parity", "0"))
        pricing = _to_float(r.get("pricing_ballpark_parity", "0"))
        network = _to_float(r.get("network_parity", "0"))
        missing = _to_float(r.get("missing_count", "0"))
        extra = _to_float(r.get("extra_count", "0"))
        # Weighted reconciliation risk score.
        r["_gap_score"] = str(
            round(
                (100.0 - provider) * 0.45
                + (100.0 - pricing) * 0.35
                + (100.0 - network) * 0.10
                + min(100.0, missing * 2.5 + extra * 0.15) * 0.10,
                2,
            )
        )

    ranked = sorted(rows, key=lambda x: _to_float(x["_gap_score"]), reverse=True)[:20]

    lines = [
        "# AnaCare vs Benchmark Reconciliation (Top 20)",
        "",
        f"Source: `{PARITY_CSV.relative_to(ROOT)}`",
        "",
        "| Rank | Procedure | ZIP | Category | Gap Score | Provider % | Pricing % | Network % | Missing | Extra |",
        "|------|-----------|-----|----------|-----------|------------|-----------|-----------|---------|-------|",
    ]
    for i, r in enumerate(ranked, 1):
        lines.append(
            f"| {i} | {r.get('procedure_id','')} | {r.get('zip','')} | {r.get('category','')} | "
            f"{r.get('_gap_score','0')} | {r.get('provider_parity','0')} | {r.get('pricing_ballpark_parity','0')} | "
            f"{r.get('network_parity','0')} | {r.get('missing_count','0')} | {r.get('extra_count','0')} |"
        )

    lines.extend(
        [
            "",
            "## Notes",
            "- `Gap Score` prioritizes provider and pricing parity gaps first.",
            "- This report is intended for weekly parity triage and remediation planning.",
            "- Use procedure+zip rows above to drive focused parser/matching fixes.",
            "",
        ]
    )

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
