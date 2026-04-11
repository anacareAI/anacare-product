"""Download US ZIP centroid data and load into Postgres zipcodes + backfill hospitals."""

import csv
import io
import logging
import os
import tempfile
import zipfile

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import execute_values

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIMPLEMAPS_ZIP_URL = (
    "https://simplemaps.com/static/data/us-zips/1.82/basic/"
    "simplemaps_uszips_basicv1.82.zip"
)
GEONAMES_ZIP_URL = "https://download.geonames.org/export/zip/US.zip"
BATCH_SIZE = 1000

INSERT_SQL = """
INSERT INTO zipcodes (zip, lat, lng, city, state)
VALUES %s
ON CONFLICT (zip) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng
"""

UPDATE_ZIP_GEOM_SQL = """
UPDATE zipcodes
SET geom = ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)
"""

UPDATE_HOSPITALS_SQL = """
UPDATE hospitals h
SET
    lat = z.lat,
    lng = z.lng,
    geom = ST_SetSRID(ST_MakePoint(z.lng::double precision, z.lat::double precision), 4326)
FROM zipcodes z
WHERE h.zip = z.zip AND h.lat IS NULL
"""


def connect() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def download_zip_bytes() -> tuple[bytes, str]:
    urls = [SIMPLEMAPS_ZIP_URL, GEONAMES_ZIP_URL]
    for url in urls:
        logger.info("Downloading %s", url)
        try:
            resp = requests.get(url, timeout=120, headers={"User-Agent": "anacare-zipcodes/1.0"})
            resp.raise_for_status()
            return resp.content, url
        except requests.RequestException as e:
            logger.warning("Download failed for %s: %s", url, e)
    raise RuntimeError("Unable to download ZIP centroid source from supported URLs")


def iter_zip_rows(zip_bytes: bytes, source_url: str):
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=True) as tmp:
        tmp.write(zip_bytes)
        tmp.flush()
        with zipfile.ZipFile(tmp.name, "r") as zf:
            if source_url == SIMPLEMAPS_ZIP_URL:
                with zf.open("uszips.csv") as raw:
                    text = io.TextIOWrapper(raw, encoding="utf-8")
                    reader = csv.DictReader(text)
                    for row in reader:
                        z = (row.get("zip") or "").strip()
                        lat = (row.get("lat") or "").strip()
                        lng = (row.get("lng") or "").strip()
                        city = (row.get("city") or "").strip()
                        state = (row.get("state_id") or "").strip()
                        if not z:
                            continue
                        yield (z, lat, lng, city, state)
                return

            # GeoNames fallback format: country,zip,place,state,state_code,county,county_code,community,community_code,lat,lng,accuracy
            with zf.open("US.txt") as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8")
                reader = csv.reader(text, delimiter="\t")
                for row in reader:
                    if len(row) < 11:
                        continue
                    if row[0] != "US":
                        continue
                    z = (row[1] or "").strip()
                    city = (row[2] or "").strip()
                    state = (row[4] or "").strip()
                    lat = (row[9] or "").strip()
                    lng = (row[10] or "").strip()
                    if not z:
                        continue
                    yield (z, lat, lng, city, state)


def main() -> None:
    zip_bytes, source_url = download_zip_bytes()
    data = list(iter_zip_rows(zip_bytes, source_url))
    n = len(data)

    conn = connect()
    try:
        with conn.cursor() as cur:
            for i in range(0, n, BATCH_SIZE):
                batch = data[i : i + BATCH_SIZE]
                execute_values(cur, INSERT_SQL, batch, page_size=len(batch))
            cur.execute("SAVEPOINT zip_geom_sp")
            try:
                cur.execute(UPDATE_ZIP_GEOM_SQL)
                cur.execute(UPDATE_HOSPITALS_SQL)
            except psycopg2.Error as e:
                # Allow environments without PostGIS extension to continue.
                logger.warning("Skipping geom updates (PostGIS unavailable): %s", e)
                cur.execute("ROLLBACK TO SAVEPOINT zip_geom_sp")
            m = cur.rowcount
        conn.commit()
    finally:
        conn.close()

    print(f"Loaded {n} zip codes from {source_url}. Backfilled {m} hospital coordinates.")


if __name__ == "__main__":
    main()
