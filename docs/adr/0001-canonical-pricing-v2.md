# ADR 0001: Canonical Pricing v2 Contract

## Status
Accepted

## Context
Search results previously mixed DB-backed values with JSON fallbacks and synthetic factors. Product requirements now require plan-aware negotiated rates, provenance metadata, and OOP only after explicit benefits opt-in.

## Decision
1. Introduce v2 API contracts:
   - `POST /v2/search/hospitals`
   - `GET /v2/providers/{ccn}/episode`
   - `GET /v2/plans/{plan_id}/benefits`
2. Disable JSON fallback for pricing searches and episode calculations.
3. Return provenance metadata on every provider price row:
   - `match_level`
   - `source_provenance`
   - `effective_date`
   - `ingestion_timestamp`
4. Gate OOP computation behind `benefits_opt_in=true`.

## Consequences
- Environments without DB data now fail fast with explicit `503` errors.
- Clients can distinguish exact plan matches vs fallback matches.
- OOP output aligns with benefits opt-in UX and avoids implicit assumptions.
- Additional schema evolution is required for `benefit_templates` and provider-plan network mappings.
