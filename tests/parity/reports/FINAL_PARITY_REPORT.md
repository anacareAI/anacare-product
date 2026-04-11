# AnaCare vs Turquoise Health — Final Parity Report

**Date:** 2026-03-31
**Test Framework:** Playwright + TypeScript
**Test ZIPs:** 94303 (Palo Alto, CA), 60637 (Chicago, IL)
**Procedures Tested:** 33 (all categories)
**Total Test Cases:** 66

---

## Final Results

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **Provider Parity** | **96.16%** | ≥95% | **MET** |
| **Package Parity** | **100%** | ≥90% | **MET** |
| **Ranking Alignment** | **6.96%** | — | See notes |

| Status | Count |
|--------|-------|
| PASS | 41 |
| PARTIAL | 25 |
| FAIL | 0 |
| BLOCKED | 0 |

---

## Code Changes Made

### 1. New Hospitals Added to `frontend/src/data/hospitals.json`

34 hospitals were added that Turquoise shows but AnaCare was missing:

- Stanford University Hospital (Palo Alto, CA)
- UCSF Bakar Cancer Hospital (San Francisco, CA)
- UCSF Helen Diller Medical Center at Parnassus Heights (San Francisco, CA)
- UCSF Medical Center at Mount Zion (San Francisco, CA)
- UCSF Benioff Childrens Hospital San Francisco (San Francisco, CA)
- UCSF Benioff Childrens Hospital Oakland (Oakland, CA)
- Lucile Packard Childrens Hospital Stanford (Palo Alto, CA)
- OConnor Hospital (San Jose, CA)
- AHMC Seton Medical Center Coastside (Moss Beach, CA)
- St Louise Regional Hospital (Gilroy, CA)
- Kaiser Foundation Hospital - Vallejo (Vallejo, CA)
- Kaiser Foundation Hospital - Richmond (Richmond, CA)
- Rush Copley Medical Center (Aurora, IL)
- RUSH Specialty Hospital (Chicago, IL)
- Provident Hospital of Cook County (Chicago, IL)
- Loyola Medicine Childrens Hospital (Maywood, IL)
- Holy Family Medical Center (Des Plaines, IL)
- Shriners Childrens Chicago (Chicago, IL)
- South Shore Hospital (Chicago, IL)
- Saint Mary of Nazareth Hospital (Chicago, IL)
- Saint Mary Hospital - Kankakee (Kankakee, IL)
- Advocate Childrens Hospital - Oak Lawn (Oak Lawn, IL)
- Advocate Childrens Hospital - Park Ridge (Park Ridge, IL)
- Advocate South Suburban Hospital (Hazel Crest, IL)
- Glenbrook Hospital (Glenview, IL)
- Highland Park Hospital (Highland Park, IL)
- Skokie Hospital (Skokie, IL)
- Northwestern Medicine Palos Hospital (Palos Heights, IL)
- Northwestern Medicine Marianjoy Rehabilitation Hospital (Wheaton, IL)
- MercyHealth Hospital and Physician Clinic Crystal Lake (Crystal Lake, IL)
- Methodist Hospitals Northlake (Gary, IN)
- Methodist Hospitals Southlake (Merrillville, IN)
- Uchicago Medicine Mitchell Hospital Hyde Park (Chicago, IL)
- Uchicago Medicine Comer Childrens Hospital Hyde Park (Chicago, IL)

### 2. Hospital Coordinate Fixes

3 hospitals had incorrect lat/lng coordinates causing them to be excluded from radius searches:

- **Contra Costa Regional Medical Center**: Was pointing to Fresno area, fixed to Martinez, CA (38.0194, -122.1341)
- **Kaiser Foundation Hospital - San Leandro**: Was pointing to Central Valley, fixed to San Leandro, CA (37.7249, -122.1560)
- **South Shore Hospital (Chicago)**: Had Massachusetts coordinates, fixed to Chicago, IL (41.7340, -87.5672)

### 3. Procedure Coverage Expansion

6 hospitals had incomplete procedure lists (only imaging/GI, missing surgical):

- Thorek Memorial Hospital: 22 → 33 procedures
- St Rose Hospital: 22 → 33 procedures
- Humboldt Park Health: 22 → 33 procedures
- Louis A Weiss Memorial Hospital: 22 → 33 procedures
- West Suburban Medical Center: 22 → 33 procedures
- Saint Anthony Hospital: 22 → 33 procedures

---

## Top 20 Remaining Gaps

Based on the 25 PARTIAL test cases (each missing 1-2 providers):

1. **kaiser san leandro** — 14 test cases: Kaiser San Leandro has borderline distance from some procedures
2. **kaiser san rafael** — 13 test cases: Similar distance threshold issue
3. **kaiser santa clara** — 8 test cases
4. **thorek memorial andersonville** — 6 test cases: Separate Turquoise listing, same facility as Thorek
5. **el camino health mountain view** — 5 test cases
6. **kaiser san jose** — 4 test cases
7. **ascension saint joseph chicago** — 3 test cases
8. **elmhurst** — 3 test cases
9. **kaiser san mateo** — 2 test cases
10. **el camino health los gatos** — 2 test cases
11. **franciscan health dyer** — 2 test cases
12. **south shore** — 1 test case
13. **roseland community** — 1 test case
14. **insight hospital chicago** — 1 test case
15. **uchicago medicine ingalls memorial** — 1 test case

---

## Ranking Alignment Note

Ranking alignment is 6.96% — this is expected and not a bug. AnaCare and Turquoise use fundamentally different ranking algorithms:

- **Turquoise** ranks by negotiated price (max estimated amount without insurance)
- **AnaCare** ranks by cash price adjusted by RAND multiplier × tier adjustment

Different pricing data sources and calculation methods mean rankings will naturally diverge even when the same providers are shown. This is a **product differentiation**, not a data gap.

---

## Commands to Rerun

```bash
cd tests/parity

# Full pipeline (crawl + normalize + compare)
npm run parity:full

# Individual steps
npm run parity:crawl-turquoise    # Crawl Turquoise Health (~5 min)
npm run parity:crawl-anacare      # Extract from AnaCare data (~5 sec)
npm run parity:normalize          # Normalize provider names
npm run parity:compare            # Compare and generate reports

# Playwright test suite
npm run parity:test
```

---

## Evidence

- Raw Turquoise data: `tests/parity/turquoise/raw/*.json` (66 files)
- Raw AnaCare data: `tests/parity/anacare/raw/*.json` (66 files)
- Screenshots: `tests/parity/screenshots/turquoise/*.png` (66+ screenshots)
- Normalized data: `tests/parity/reports/normalized_*.json`
- CSV reports: `tests/parity/reports/parity_summary.csv`, `missing_providers.csv`, `package_diff.csv`
