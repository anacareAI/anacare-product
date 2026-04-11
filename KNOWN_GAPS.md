# Known Gaps — AnaCare Consumer Platform v1

## Data Pipeline

1. **NPPES download**: The full NPPES file is ~8GB. `ingest_nppes.py` attempts auto-download but may timeout. Use `--file` with a pre-downloaded zip for reliability.

2. **Medicare Part B download**: The 2.5GB CSV cannot be auto-downloaded from CMS reliably. `ingest_part_b.py` will print download instructions and exit if `--file` is not provided.

3. **HealthCare.gov 2026 plans**: The current CMS artifact is an XLSX inside a ZIP, not a CSV. Manual export to CSV is required before running `ingest_plans.py --file`.

4. **RAND hospital multipliers**: Requires manual download from rand.org (terms acceptance). Run `ingest_rand.py --file <path>` with the downloaded CSV.

5. **CMS Facility Affiliation API**: Column names in the CMS dataset may change. `ingest_affiliations.py` auto-detects NPI/CCN columns from the first row but may need adjustment if the API schema changes.

6. **Zipcodes download**: SimpleMaps URL is version-pinned to 1.82. If this version is removed, update the URL in `ingest_zipcodes.py`.

## Backend

7. **Plan lookup in rank-providers**: Currently fetches plan details inside the provider loop (N+1 query). Should be cached or fetched once before the loop.

8. **Quality score formula**: Uses a placeholder 40% component. Need to integrate patient satisfaction, HCAHPS, and additional CMS quality measures for the full 100-point scale.

9. **Rate matching**: `rank-providers` matches on `r.plan_id` but real MRF rates may not always have plan_id populated. Need fallback to payer-level rate matching.

10. **Episode endpoint**: The `/providers/{ccn}/episode` endpoint picks the lowest rate across all providers affiliated with that CCN. Should allow specifying a specific NPI for per-surgeon pricing.

## Frontend

11. **Multi-procedure support**: The search form allows selecting multiple procedures, but the results page only uses `procedures[0]`. Multi-procedure comparison view is not yet implemented.

12. **Plan coinsurance/copay**: Most plans ingested from HealthCare.gov will have NULL coinsurance_pct and copay fields. The OOP engine defaults to 20% coinsurance when NULL — users should verify against their actual plan documents.

13. **Geolocation to ZIP**: When using browser geolocation, we store lat/lng but not a ZIP code. The rank-providers API requires a ZIP. Need to add reverse geocoding (lat/lng → nearest ZIP) in the backend.

14. **Mobile responsive**: Components are built with basic responsive breakpoints but haven't been thoroughly tested on all mobile viewports.

## Integration

15. **PostGIS required**: The database requires the PostGIS extension. `CREATE EXTENSION IF NOT EXISTS postgis` is in the schema migration but requires superuser privileges or the extension to be pre-installed.

16. **No authentication**: The API has no auth layer. All endpoints are publicly accessible. Add API key or OAuth before any production deployment.

17. **No rate limiting**: Backend has no request rate limiting. Add before production use.

18. **CORS wide open**: CORSMiddleware allows all origins. Restrict to frontend domain in production.
