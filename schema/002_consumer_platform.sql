-- AnaCare Consumer Platform — Additional Tables
-- Depends on 001_base.sql

CREATE TABLE IF NOT EXISTS hospitals (
  ccn              TEXT PRIMARY KEY,
  name             TEXT,
  city             TEXT,
  state            TEXT,
  zip              TEXT,
  lat              NUMERIC(9,6),
  lng              NUMERIC(9,6),
  cms_star_rating  NUMERIC(3,1),
  rand_multiplier  NUMERIC(6,4),
  last_updated     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospital_quality (
  ccn                 TEXT NOT NULL,
  measure_id          TEXT NOT NULL,
  score               NUMERIC(8,4),
  national_avg        NUMERIC(8,4),
  compared_to_national TEXT,
  year                INTEGER,
  PRIMARY KEY (ccn, measure_id)
);

CREATE TABLE IF NOT EXISTS affiliations (
  npi    TEXT NOT NULL,
  ccn    TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (npi, ccn)
);

CREATE TABLE IF NOT EXISTS surgeon_volume (
  npi           TEXT NOT NULL,
  cpt_code      TEXT NOT NULL,
  annual_volume INTEGER,
  year          INTEGER,
  PRIMARY KEY (npi, cpt_code, year)
);

CREATE TABLE IF NOT EXISTS plans (
  plan_id          TEXT PRIMARY KEY,
  plan_name        TEXT,
  payer            TEXT,
  metal_tier       TEXT,
  network_type     TEXT,
  state            TEXT,
  deductible_ind   NUMERIC(10,2),
  deductible_fam   NUMERIC(10,2),
  oop_max_ind      NUMERIC(10,2),
  oop_max_fam      NUMERIC(10,2),
  coinsurance_pct  NUMERIC(5,4),
  pc_copay         NUMERIC(8,2),
  specialist_copay NUMERIC(8,2),
  er_copay         NUMERIC(8,2),
  uc_copay         NUMERIC(8,2),
  rx_tier1         NUMERIC(8,2),
  rx_tier2         NUMERIC(8,2),
  rx_tier3         NUMERIC(8,2)
);

CREATE TABLE IF NOT EXISTS zipcodes (
  zip   TEXT PRIMARY KEY,
  city  TEXT,
  state TEXT,
  lat   NUMERIC(9,6),
  lng   NUMERIC(9,6)
);

CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE zipcodes ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
CREATE INDEX IF NOT EXISTS idx_hospitals_geom ON hospitals USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_zipcodes_geom ON zipcodes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_affiliations_ccn ON affiliations(ccn);
CREATE INDEX IF NOT EXISTS idx_surgeon_volume_cpt ON surgeon_volume(cpt_code);
