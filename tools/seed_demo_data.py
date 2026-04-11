"""
seed_demo_data.py

Inserts realistic demo data into a local PostgreSQL instance for development
and demo purposes when real MRF/CMS data is not yet ingested.

Usage:
    python tools/seed_demo_data.py
"""

import logging
import os
import sys
from datetime import date

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def get_connection():
    password = os.environ.get("DB_PASSWORD", "")
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=password or None,
        connect_timeout=15,
        sslmode="require" if password else "prefer",
    )


HOSPITALS = [
    ("140281", "Northwestern Memorial Hospital", "Chicago", "IL", "60611", 41.8962, -87.6213, 5.0, 2.89),
    ("140119", "Rush University Medical Center", "Chicago", "IL", "60612", 41.8748, -87.6697, 5.0, 3.05),
    ("140088", "University of Chicago Medicine", "Chicago", "IL", "60637", 41.7891, -87.6048, 4.0, 2.72),
    ("140010", "NorthShore University HealthSystem", "Evanston", "IL", "60201", 42.0654, -87.6829, 4.0, 2.45),
    ("140182", "Advocate Illinois Masonic Medical Center", "Chicago", "IL", "60657", 41.9393, -87.6741, 3.0, 2.28),
]

ZIPCODES = [
    ("60601", "Chicago", "IL", 41.8819, -87.6278),
    ("60611", "Chicago", "IL", 41.8962, -87.6213),
    ("60612", "Chicago", "IL", 41.8748, -87.6697),
    ("60637", "Chicago", "IL", 41.7891, -87.6048),
    ("60201", "Evanston", "IL", 42.0654, -87.6829),
    ("60657", "Chicago", "IL", 41.9393, -87.6741),
    ("60640", "Chicago", "IL", 41.9719, -87.6598),
]

SURGEONS = [
    ("1234567890", "Levine, Brett R.", "MD, MS, FACS", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60611", date(2004, 3, 15), "140281", 320),
    ("1234567891", "Della Valle, Craig J.", "MD", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60611", date(2001, 7, 1), "140281", 185),
    ("1234567892", "Sporer, Scott M.", "MD, MS, FACS", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60612", date(1999, 1, 10), "140119", 450),
    ("1234567893", "Fernandez, Jorge L.", "MD", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60612", date(2010, 9, 20), "140119", 95),
    ("1234567894", "Manning, David W.", "MD, FACS", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60637", date(2003, 5, 5), "140088", 280),
    ("1234567895", "Gonzalez, Monica H.", "MD, PhD", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60637", date(2007, 11, 30), "140088", 145),
    ("1234567896", "Van Thiel, Geoffrey S.", "MD, MBA, FACS", "Orthopedic Surgery", "207X00000X", "Evanston", "IL", "60201", date(2006, 2, 14), "140010", 210),
    ("1234567897", "Hsu, Wellington K.", "MD", "Orthopedic Surgery", "207X00000X", "Evanston", "IL", "60201", date(2008, 6, 8), "140010", 80),
    ("1234567898", "Gerlach, Eric B.", "MD, FACS", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60657", date(2005, 8, 22), "140182", 175),
    ("1234567899", "Mather, Richard C.", "MD, MBA", "Orthopedic Surgery", "207X00000X", "Chicago", "IL", "60657", date(2011, 4, 3), "140182", 110),
]

PLANS = [
    ("AETNA-PPO-GOLD-IL-2026", "Aetna PPO Gold IL 2026", "Aetna", "Gold", "PPO", "IL",
     1500, 3000, 6000, 12000, 0.20, 25, 50, 350, 75, 10, 35, 70),
    ("AETNA-PPO-SILVER-IL-2026", "Aetna PPO Silver IL 2026", "Aetna", "Silver", "PPO", "IL",
     3500, 7000, 8000, 16000, 0.30, 35, 65, 450, 100, 15, 45, 90),
    ("AETNA-HMO-BRONZE-IL-2026", "Aetna HMO Bronze IL 2026", "Aetna", "Bronze", "HMO", "IL",
     6000, 12000, 8550, 17100, 0.40, 40, 75, 500, 125, 15, 50, 100),
]

_PLAN = "AETNA-PPO-GOLD-IL-2026"
_FFS = "fee_for_service"
_INST = "institutional"

_NPIS = [f"123456789{i}" for i in range(10)]

_CPT_RATES = {
    "27447": [18400, 16200, 32000, 21500, 24800, 19700, 14000, 17500, 22300, 15800],
    "27130": [20100, 17800, 34500, 23000, 26200, 21300, 15200, 18900, 24100, 17000],
    "29888": [12800, 11500, 22000, 15200, 17600, 14100, 10000, 12500, 15900, 11200],
    "29827": [10200, 9100, 17500, 12100, 14000, 11200, 8000, 10000, 12700, 8900],
    "27446": [16800, 14900, 29000, 19600, 22600, 18000, 12800, 16000, 20400, 14400],
    "29882": [6200, 5500, 10600, 7300, 8500, 6800, 4800, 6000, 7600, 5400],
    "27702": [24500, 21700, 42000, 28400, 32700, 26100, 18600, 23200, 29600, 20900],
    "23472": [22100, 19600, 37900, 25600, 29500, 23600, 16800, 20900, 26700, 18800],
    "64721": [4800, 4300, 8200, 5700, 6500, 5200, 3700, 4600, 5900, 4200],
    "27125": [19200, 17000, 32900, 22200, 25600, 20400, 14600, 18100, 23100, 16300],
    "22612": [35000, 31000, 60000, 40500, 46700, 37300, 26600, 33100, 42300, 29800],
    "22856": [42000, 37200, 72000, 48600, 56000, 44800, 31900, 39700, 50700, 35800],
    "63047": [18500, 16400, 31600, 21400, 24600, 19700, 14000, 17500, 22300, 15700],
    "63030": [15200, 13500, 26000, 17600, 20200, 16200, 11500, 14400, 18300, 12900],
    "22551": [32000, 28400, 54700, 37000, 42600, 34100, 24300, 30200, 38600, 27200],
    "33533": [48000, 42500, 82000, 55400, 63900, 51100, 36400, 45300, 57900, 40800],
    "93510": [8500, 7500, 14500, 9800, 11300, 9000, 6400, 8000, 10200, 7200],
    "92928": [22000, 19500, 37600, 25400, 29300, 23400, 16700, 20800, 26500, 18700],
    "33361": [52000, 46100, 88800, 60000, 69100, 55300, 39400, 49000, 62600, 44200],
    "93653": [18000, 16000, 30700, 20800, 23900, 19100, 13600, 17000, 21700, 15300],
    "47562": [9800, 8700, 16700, 11300, 13000, 10400, 7400, 9200, 11800, 8300],
    "44950": [11500, 10200, 19600, 13300, 15300, 12200, 8700, 10800, 13800, 9700],
    "49505": [8200, 7300, 14000, 9500, 10900, 8700, 6200, 7700, 9900, 7000],
    "44140": [22500, 20000, 38400, 26000, 29900, 23900, 17000, 21200, 27100, 19100],
    "60240": [14500, 12900, 24800, 16800, 19300, 15400, 11000, 13700, 17500, 12300],
    "43280": [16800, 14900, 28700, 19400, 22400, 17900, 12700, 15800, 20200, 14300],
    "43644": [28000, 24800, 47800, 32300, 37200, 29800, 21200, 26400, 33700, 23800],
    "43775": [24000, 21300, 41000, 27700, 31900, 25500, 18200, 22600, 28900, 20400],
    "43770": [18000, 16000, 30700, 20800, 23900, 19100, 13600, 17000, 21700, 15300],
    "61510": [38000, 33700, 64900, 43900, 50500, 40400, 28800, 35800, 45800, 32300],
    "61886": [55000, 48700, 93900, 63500, 73100, 58500, 41700, 51800, 66200, 46700],
    "64702": [8800, 7800, 15000, 10200, 11700, 9400, 6700, 8300, 10600, 7500],
    "55866": [18500, 16400, 31600, 21400, 24600, 19700, 14000, 17500, 22300, 15700],
    "52353": [9500, 8400, 16200, 11000, 12600, 10100, 7200, 8900, 11400, 8100],
    "52601": [12000, 10600, 20500, 13800, 15900, 12700, 9100, 11300, 14400, 10200],
    "52204": [5800, 5100, 9900, 6700, 7700, 6200, 4400, 5500, 7000, 4900],
    "58552": [16000, 14200, 27300, 18500, 21300, 17000, 12100, 15100, 19300, 13600],
    "58545": [18500, 16400, 31600, 21400, 24600, 19700, 14000, 17500, 22300, 15700],
    "58661": [12500, 11100, 21300, 14400, 16600, 13300, 9500, 11800, 15000, 10600],
    "66984": [5200, 4600, 8900, 6000, 6900, 5500, 3900, 4900, 6300, 4400],
    "66999": [4200, 3700, 7200, 4900, 5600, 4500, 3200, 4000, 5100, 3600],
    "66180": [9800, 8700, 16700, 11300, 13000, 10400, 7400, 9200, 11800, 8300],
    "42821": [7500, 6600, 12800, 8700, 10000, 8000, 5700, 7100, 9000, 6400],
    "31255": [9200, 8200, 15700, 10600, 12200, 9800, 7000, 8700, 11100, 7800],
}

RATES = []
for cpt, rates in _CPT_RATES.items():
    for i, rate in enumerate(rates):
        RATES.append((_NPIS[i], _PLAN, cpt, rate, _FFS, _INST))

QUALITY = [
    ("140281", "COMP_HIP_KNEE", 0.015, 0.032, "Better than the National Rate", 2024),
    ("140281", "READM_30_HOSP_WIDE", 0.92, 1.00, "No Different than the National Rate", 2024),
    ("140119", "COMP_HIP_KNEE", 0.022, 0.032, "No Different than the National Rate", 2024),
    ("140119", "READM_30_HOSP_WIDE", 0.88, 1.00, "Better than the National Rate", 2024),
    ("140088", "COMP_HIP_KNEE", 0.028, 0.032, "No Different than the National Rate", 2024),
    ("140088", "READM_30_HOSP_WIDE", 0.95, 1.00, "No Different than the National Rate", 2024),
    ("140010", "COMP_HIP_KNEE", 0.035, 0.032, "No Different than the National Rate", 2024),
    ("140010", "READM_30_HOSP_WIDE", 1.02, 1.00, "Worse than the National Rate", 2024),
    ("140182", "COMP_HIP_KNEE", 0.042, 0.032, "Worse than the National Rate", 2024),
    ("140182", "READM_30_HOSP_WIDE", 1.05, 1.00, "Worse than the National Rate", 2024),
]


def seed(conn):
    with conn.cursor() as cur:
        log.info("Seeding zipcodes...")
        psycopg2.extras.execute_values(cur, """
            INSERT INTO zipcodes (zip, city, state, lat, lng)
            VALUES %s ON CONFLICT (zip) DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng
        """, ZIPCODES)

        log.info("Seeding hospitals...")
        psycopg2.extras.execute_values(cur, """
            INSERT INTO hospitals (ccn, name, city, state, zip, lat, lng, cms_star_rating, rand_multiplier)
            VALUES %s ON CONFLICT (ccn) DO UPDATE SET
                name=EXCLUDED.name, city=EXCLUDED.city, state=EXCLUDED.state,
                zip=EXCLUDED.zip, lat=EXCLUDED.lat, lng=EXCLUDED.lng,
                cms_star_rating=EXCLUDED.cms_star_rating, rand_multiplier=EXCLUDED.rand_multiplier
        """, HOSPITALS)

        log.info("Seeding providers...")
        cur.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS credentials TEXT")
        cur.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS npi_enum_date DATE")
        for s in SURGEONS:
            npi, name, creds, spec, tax, city, state, zip_code, enum_date, ccn, volume = s
            cur.execute("""
                INSERT INTO providers (npi, name, credentials, specialty, taxonomy_code, city, state, zip, npi_resolved, npi_enum_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
                ON CONFLICT (npi) DO UPDATE SET
                    name=EXCLUDED.name, credentials=EXCLUDED.credentials, specialty=EXCLUDED.specialty,
                    taxonomy_code=EXCLUDED.taxonomy_code, city=EXCLUDED.city, state=EXCLUDED.state,
                    zip=EXCLUDED.zip, npi_enum_date=EXCLUDED.npi_enum_date
            """, (npi, name, creds, spec, tax, city, state, zip_code, enum_date))

        log.info("Seeding affiliations...")
        for s in SURGEONS:
            npi, _, _, _, _, _, _, _, _, ccn, _ = s
            cur.execute("""
                INSERT INTO affiliations (npi, ccn, source)
                VALUES (%s, %s, 'seed_data')
                ON CONFLICT (npi, ccn) DO NOTHING
            """, (npi, ccn))

        log.info("Seeding surgeon_volume...")
        for s in SURGEONS:
            npi, _, _, _, _, _, _, _, _, _, volume = s
            cur.execute("""
                INSERT INTO surgeon_volume (npi, cpt_code, annual_volume, year)
                VALUES (%s, '27447', %s, 2023)
                ON CONFLICT (npi, cpt_code, year) DO UPDATE SET annual_volume=EXCLUDED.annual_volume
            """, (npi, volume))

        log.info("Seeding plans...")
        psycopg2.extras.execute_values(cur, """
            INSERT INTO plans (plan_id, plan_name, payer, metal_tier, network_type, state,
                              deductible_ind, deductible_fam, oop_max_ind, oop_max_fam,
                              coinsurance_pct, pc_copay, specialist_copay, er_copay, uc_copay,
                              rx_tier1, rx_tier2, rx_tier3)
            VALUES %s ON CONFLICT (plan_id) DO UPDATE SET
                plan_name=EXCLUDED.plan_name, payer=EXCLUDED.payer,
                metal_tier=EXCLUDED.metal_tier, coinsurance_pct=EXCLUDED.coinsurance_pct,
                deductible_ind=EXCLUDED.deductible_ind, oop_max_ind=EXCLUDED.oop_max_ind,
                rx_tier1=EXCLUDED.rx_tier1, rx_tier2=EXCLUDED.rx_tier2, rx_tier3=EXCLUDED.rx_tier3
        """, PLANS)

        log.info(f"Seeding rates ({len(RATES)} rows)...")
        for batch_start in range(0, len(RATES), 100):
            batch = RATES[batch_start:batch_start + 100]
            psycopg2.extras.execute_values(cur, """
                INSERT INTO rates (npi, plan_id, cpt_code, rate, rate_type, billing_class)
                VALUES %s ON CONFLICT (npi, cpt_code, rate_type, billing_class) DO UPDATE SET
                    rate=EXCLUDED.rate, plan_id=EXCLUDED.plan_id, ingested_at=NOW()
            """, batch)

        log.info("Seeding hospital_quality...")
        psycopg2.extras.execute_values(cur, """
            INSERT INTO hospital_quality (ccn, measure_id, score, national_avg, compared_to_national, year)
            VALUES %s ON CONFLICT (ccn, measure_id) DO UPDATE SET
                score=EXCLUDED.score, national_avg=EXCLUDED.national_avg,
                compared_to_national=EXCLUDED.compared_to_national
        """, QUALITY)

    conn.commit()


def verify(conn):
    with conn.cursor() as cur:
        counts = {}
        for table in ["hospitals", "providers", "affiliations", "surgeon_volume", "plans", "rates", "hospital_quality", "zipcodes"]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cur.fetchone()[0]

    log.info("=== Seed verification ===")
    for table, count in counts.items():
        log.info(f"  {table}: {count} rows")

    return counts


def main():
    log.info("=== AnaCare: Seed Demo Data ===")

    try:
        conn = get_connection()
        log.info("DB connection established")
    except psycopg2.OperationalError as e:
        log.error(f"DB connection failed: {e}")
        log.error("Make sure DB_* env vars are set and PostgreSQL is running")
        sys.exit(1)

    seed(conn)
    counts = verify(conn)

    log.info("\n=== Seeding complete ===")
    log.info(f"Hospitals: {counts['hospitals']}, Providers: {counts['providers']}, "
             f"Plans: {counts['plans']}, Rates: {counts['rates']}")
    log.info("\nTo start the backend:")
    log.info("  cd /Users/joshuakao/anacare_product && python -m backend.main")
    log.info("\nTo start the frontend:")
    log.info("  cd /Users/joshuakao/anacare_product/frontend && npm run dev")
    log.info("\nTest the API:")
    log.info('  curl -X POST http://localhost:8000/rank-providers -H "Content-Type: application/json" '
             '-d \'{"cpt_code":"27447","plan_id":"AETNA-PPO-GOLD-IL-2026","zip":"60601","radius_miles":25,'
             '"deductible_remaining":1400,"oop_max_remaining":4600}\'')

    conn.close()


if __name__ == "__main__":
    main()
