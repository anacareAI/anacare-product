#!/usr/bin/env python3
"""
Run a reproducible ingest sequence for one payer + one region (state).

This is an operational wrapper around existing ingest scripts to satisfy
Phase 1 pipeline reproducibility.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_step(cmd: list[str], required: bool = True) -> bool:
    print(f"\n>>> {' '.join(cmd)}")
    rc = subprocess.run(cmd, cwd=ROOT).returncode
    if rc != 0:
        if required:
            raise RuntimeError(f"Step failed ({rc}): {' '.join(cmd)}")
        print(f"WARNING: optional step failed ({rc}): {' '.join(cmd)}")
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest one payer + one region pipeline.")
    parser.add_argument("--payer-brand", default="ALICSI", help="Aetna brand code for fetch_mrf_index.py")
    parser.add_argument("--state", required=True, help="Target market state (for reporting scope), e.g. IL")
    parser.add_argument("--mrf-file-limit", type=int, default=1, help="Number of MRF files to process")
    parser.add_argument("--max-rate-records", type=int, default=0, help="Optional cap for streaming rates")
    parser.add_argument("--max-affiliation-pages", type=int, default=25, help="Cap CMS affiliation pages for regional run")
    args = parser.parse_args()

    print("=== AnaCare One-Payer Region Ingest ===")
    print(f"State scope: {args.state}")
    print(f"Payer brand: {args.payer_brand}")

    run_step([sys.executable, "tools/ingest_zipcodes.py"])
    run_step([sys.executable, "tools/ingest_hospitals.py"])
    run_step([sys.executable, "tools/ingest_quality.py"])
    run_step([sys.executable, "tools/ingest_nppes.py"])
    run_step(
        [sys.executable, "tools/ingest_affiliations.py", "--max-pages", str(args.max_affiliation_pages)],
        required=False,
    )
    run_step([sys.executable, "tools/ingest_plans.py"], required=False)

    run_step([
        sys.executable,
        "tools/fetch_mrf_index.py",
        "--brand",
        args.payer_brand,
        "--limit",
        str(args.mrf_file_limit),
    ])

    stream_cmd = [sys.executable, "tools/stream_mrf_file.py", "--links", ".tmp/aetna_mrf_links.json"]
    if args.max_rate_records > 0:
        stream_cmd.extend(["--max-records", str(args.max_rate_records)])
    run_step(stream_cmd)

    run_step([sys.executable, "tools/load_rates_db.py", "--init-schema"])
    run_step([sys.executable, "tools/reconcile_top20.py"])

    print("\n=== Pipeline complete ===")
    print("Generated:")
    print("- tests/parity/reports/anacare_vs_benchmark_top20.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
