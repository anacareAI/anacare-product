#!/usr/bin/env bash
set -e

echo "=== AnaCare MRF Pipeline ==="
echo "Step 1/3: Fetch MRF index..."
python tools/fetch_mrf_index.py

echo "Step 2/3: Stream MRF files..."
python tools/stream_mrf_file.py --links .tmp/aetna_mrf_links.json

echo "Step 3/3: Load rates to DB..."
python tools/load_rates_db.py

echo "=== Pipeline complete ==="
