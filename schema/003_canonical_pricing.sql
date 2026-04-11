-- AnaCare Canonical Pricing + Benefit Templates (v2)
-- Depends on 002_consumer_platform.sql

CREATE TABLE IF NOT EXISTS provider_plan_networks (
  ccn                 TEXT NOT NULL,
  plan_id             TEXT NOT NULL,
  payer               TEXT,
  network_type        TEXT,
  product_name        TEXT,
  market_state        TEXT,
  match_level         TEXT NOT NULL DEFAULT 'exact_plan_id',
  confidence_score    NUMERIC(5,4) NOT NULL DEFAULT 0.9000,
  source_provenance   JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_date      DATE,
  last_seen_at        TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (ccn, plan_id)
);

CREATE TABLE IF NOT EXISTS benefit_templates (
  plan_id                TEXT PRIMARY KEY,
  deductible_ind         NUMERIC(10,2) NOT NULL DEFAULT 0,
  deductible_fam         NUMERIC(10,2),
  oop_max_ind            NUMERIC(10,2) NOT NULL DEFAULT 99999,
  oop_max_fam            NUMERIC(10,2),
  coinsurance_pct        NUMERIC(5,4)  NOT NULL DEFAULT 0.2000,
  pc_copay               NUMERIC(8,2)  NOT NULL DEFAULT 0,
  specialist_copay       NUMERIC(8,2)  NOT NULL DEFAULT 0,
  er_copay               NUMERIC(8,2)  NOT NULL DEFAULT 0,
  uc_copay               NUMERIC(8,2)  NOT NULL DEFAULT 0,
  rx_tier1               NUMERIC(8,2)  NOT NULL DEFAULT 10,
  rx_tier2               NUMERIC(8,2)  NOT NULL DEFAULT 35,
  rx_tier3               NUMERIC(8,2)  NOT NULL DEFAULT 70,
  source_provenance      JSONB         NOT NULL DEFAULT '{}'::jsonb,
  last_updated           TIMESTAMP     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
);

ALTER TABLE rates ADD COLUMN IF NOT EXISTS source_file_ref TEXT;
ALTER TABLE rates ADD COLUMN IF NOT EXISTS source_table TEXT DEFAULT 'rates';
ALTER TABLE rates ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE rates ADD COLUMN IF NOT EXISTS ingestion_timestamp TIMESTAMP DEFAULT NOW();
ALTER TABLE rates ADD COLUMN IF NOT EXISTS match_level TEXT DEFAULT 'exact_plan_id';
ALTER TABLE rates ADD COLUMN IF NOT EXISTS source_provenance JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_provider_plan_networks_plan_id ON provider_plan_networks(plan_id);
CREATE INDEX IF NOT EXISTS idx_provider_plan_networks_ccn ON provider_plan_networks(ccn);
CREATE INDEX IF NOT EXISTS idx_rates_plan_cpt ON rates(plan_id, cpt_code);
CREATE INDEX IF NOT EXISTS idx_rates_effective_date ON rates(effective_date);

-- Keep plan defaults aligned until explicit benefit template is loaded.
INSERT INTO benefit_templates (
  plan_id, deductible_ind, deductible_fam, oop_max_ind, oop_max_fam,
  coinsurance_pct, pc_copay, specialist_copay, er_copay, uc_copay,
  rx_tier1, rx_tier2, rx_tier3, source_provenance
)
SELECT
  p.plan_id,
  COALESCE(p.deductible_ind, 0),
  p.deductible_fam,
  COALESCE(p.oop_max_ind, 99999),
  p.oop_max_fam,
  COALESCE(p.coinsurance_pct, 0.20),
  COALESCE(p.pc_copay, 0),
  COALESCE(p.specialist_copay, 0),
  COALESCE(p.er_copay, 0),
  COALESCE(p.uc_copay, 0),
  COALESCE(p.rx_tier1, 10),
  COALESCE(p.rx_tier2, 35),
  COALESCE(p.rx_tier3, 70),
  jsonb_build_object('seed', 'plans')
FROM plans p
ON CONFLICT (plan_id) DO NOTHING;
