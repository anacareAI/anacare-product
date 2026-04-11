# Pricing API v2

## POST `/v2/search/hospitals`

### Request body
- `procedure_id` (string, required)
- `zip` (string, optional if lat/lng provided)
- `lat` / `lng` (number, optional)
- `radius_miles` (number, default `50`)
- `plan_id` (string, optional)
- `cash_pay` (boolean, default `false`)
- `benefits_opt_in` (boolean, default `false`)
- `deductible_remaining` (number, default `0`)
- `oop_max_remaining` (number, default `99999`)
- `sort_by` (`lowest_cost|top_rated|nearest|best_value`)
- optional map bounds `north/south/east/west`

### Response highlights
- `api_version: "v2"`
- `hospitals[]` with:
  - `negotiated_rate_total`
  - `estimated_oop_total` (present when `benefits_opt_in=true`)
  - `match_level`
  - `source_provenance`
  - `effective_date`
  - `ingestion_timestamp`
  - `price_confidence`
  - `network_status`

## GET `/v2/providers/{ccn}/episode`

### Query params
- `cpt_code` (required)
- `plan_id` (optional)
- `benefits_opt_in` (boolean, default `false`)
- `deductible_remaining` (number, default `0`)
- `oop_max_remaining` (number, default `99999`)

### Response highlights
- `api_version: "v2"`
- `benefits_opt_in` echo
- `negotiated_rate`
- `episode` cost breakdown

## GET `/v2/plans/{plan_id}/benefits`

### Response
- Plan metadata (`plan_id`, `plan_name`, `payer`, `network_type`)
- `benefit_template`:
  - `deductible`
  - `oop_max`
  - `coinsurance_pct`
  - `pc_copay`
  - `specialist_copay`
  - `er_copay`
  - `uc_copay`

## Error behavior
- `503` when DB-backed pricing is unavailable.
- `404` for unknown ZIP, procedure mapping, provider episode rate, or plan.
