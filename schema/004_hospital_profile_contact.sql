-- Hospital profile/contact enrichment fields
-- Safe additive migration for provider profile experiences.

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS website TEXT;
