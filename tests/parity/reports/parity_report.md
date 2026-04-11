# AnaCare vs Turquoise Health — Parity Report

Generated: 2026-03-31T09:52:20.773Z

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 66 |
| PASS | 5 |
| FAIL | 0 |
| PARTIAL | 61 |
| BLOCKED | 0 |
| Provider Parity | 96.16% |
| Package Parity | 100% |
| Network Parity | 100% |
| Pricing Ballpark Parity | 27.69% |
| Ranking Alignment | 6.96% |

## Test Results by Category

### Musculoskeletal

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| ankle_arthro | 94303 | PARTIAL | 94.12% | 100% | 100% | 69.23% | 1 | 39 |
| ankle_arthro | 60637 | PARTIAL | 100% | 100% | 100% | 25% | 0 | 63 |
| finger_fracture | 94303 | PARTIAL | 90% | 100% | 100% | 0% | 2 | 31 |
| finger_fracture | 60637 | PARTIAL | 94.44% | 100% | 100% | 0% | 1 | 63 |
| clavicle_repair | 94303 | PARTIAL | 100% | 100% | 100% | 35.29% | 0 | 29 |
| clavicle_repair | 60637 | PARTIAL | 95% | 100% | 100% | 35.29% | 1 | 61 |
| wrist_repair | 94303 | PARTIAL | 100% | 100% | 100% | 12.5% | 0 | 32 |
| wrist_repair | 60637 | PARTIAL | 100% | 100% | 100% | 0% | 0 | 62 |
| hip_arthro | 94303 | PARTIAL | 94.74% | 100% | 100% | 46.67% | 1 | 36 |
| hip_arthro | 60637 | PARTIAL | 100% | 100% | 100% | 18.18% | 0 | 70 |
| knee_arthro | 94303 | PARTIAL | 95% | 100% | 100% | 31.25% | 1 | 38 |
| knee_arthro | 60637 | PARTIAL | 90% | 100% | 100% | 38.89% | 2 | 65 |
| shoulder_arthro | 94303 | PARTIAL | 85% | 100% | 100% | 53.33% | 3 | 39 |
| shoulder_arthro | 60637 | PARTIAL | 90% | 100% | 100% | 37.5% | 2 | 65 |

### Radiology & Imaging

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| breast_mri | 94303 | PARTIAL | 94.12% | 100% | 100% | 26.67% | 1 | 41 |
| breast_mri | 60637 | PARTIAL | 94.44% | 100% | 100% | 18.75% | 1 | 82 |
| breast_ultrasound | 94303 | PARTIAL | 100% | 100% | 100% | 22.22% | 0 | 40 |
| breast_ultrasound | 60637 | PARTIAL | 100% | 100% | 100% | 0% | 0 | 80 |
| ct | 94303 | PARTIAL | 100% | 100% | 100% | 38.89% | 0 | 46 |
| ct | 60637 | PARTIAL | 100% | 100% | 100% | 22.22% | 0 | 93 |
| ct_abdomen_pelvis | 94303 | PARTIAL | 94.74% | 100% | 100% | 35.29% | 1 | 49 |
| ct_abdomen_pelvis | 60637 | PARTIAL | 100% | 100% | 100% | 21.05% | 0 | 89 |
| fetal_mri | 94303 | PARTIAL | 100% | 100% | 100% | 17.65% | 0 | 41 |
| fetal_mri | 60637 | PARTIAL | 100% | 100% | 100% | 5.26% | 0 | 79 |
| mammogram | 94303 | PASS | 95% | 100% | 100% | 47.06% | 1 | 48 |
| mammogram | 60637 | PARTIAL | 100% | 100% | 100% | 5.88% | 0 | 91 |
| mri_contrast | 94303 | PARTIAL | 100% | 100% | 100% | 38.89% | 0 | 39 |
| mri_contrast | 60637 | PARTIAL | 100% | 100% | 100% | 11.76% | 0 | 81 |
| mri_no_contrast | 94303 | PARTIAL | 100% | 100% | 100% | 27.78% | 0 | 39 |
| mri_no_contrast | 60637 | PARTIAL | 100% | 100% | 100% | 5.56% | 0 | 80 |
| ultrasound | 94303 | PARTIAL | 94.44% | 100% | 100% | 60% | 1 | 50 |
| ultrasound | 60637 | PASS | 100% | 100% | 100% | 40% | 0 | 90 |
| xray | 94303 | PARTIAL | 94.74% | 100% | 100% | 31.25% | 1 | 49 |
| xray | 60637 | PARTIAL | 100% | 100% | 100% | 35.29% | 0 | 93 |

### Gastrointestinal

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| colonoscopy | 94303 | PARTIAL | 100% | 100% | 100% | 23.53% | 0 | 48 |
| colonoscopy | 60637 | PARTIAL | 95% | 100% | 100% | 0% | 1 | 81 |
| colonoscopy_stoma | 94303 | PARTIAL | 90% | 100% | 100% | 41.18% | 2 | 47 |
| colonoscopy_stoma | 60637 | PARTIAL | 100% | 100% | 100% | 5.26% | 0 | 78 |
| egd | 94303 | PARTIAL | 94.44% | 100% | 100% | 56.25% | 1 | 49 |
| egd | 60637 | PARTIAL | 100% | 100% | 100% | 21.05% | 0 | 79 |
| hernia_lap | 94303 | PARTIAL | 90% | 100% | 100% | 18.75% | 2 | 45 |
| hernia_lap | 60637 | PARTIAL | 95% | 100% | 100% | 29.41% | 1 | 79 |
| hernia_open | 94303 | PARTIAL | 100% | 100% | 100% | 35.29% | 0 | 43 |
| hernia_open | 60637 | PASS | 100% | 100% | 100% | 42.11% | 0 | 79 |

### Obstetrics

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| cesarean | 94303 | PARTIAL | 100% | 100% | 100% | 0% | 0 | 43 |
| cesarean | 60637 | PARTIAL | 94.74% | 100% | 100% | 41.67% | 1 | 62 |
| vaginal_delivery | 94303 | PARTIAL | 100% | 100% | 100% | 0% | 0 | 43 |
| vaginal_delivery | 60637 | PARTIAL | 95% | 100% | 100% | 15.38% | 1 | 61 |

### Reproductive

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| hysteroscopy | 94303 | PARTIAL | 100% | 100% | 100% | 23.53% | 0 | 37 |
| hysteroscopy | 60637 | PARTIAL | 100% | 100% | 100% | 33.33% | 0 | 63 |
| lap_ovary | 94303 | PARTIAL | 85% | 100% | 100% | 6.25% | 3 | 32 |
| lap_ovary | 60637 | PARTIAL | 85% | 100% | 100% | 21.43% | 3 | 63 |

### ENT

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| tonsil_child | 94303 | PARTIAL | 90% | 100% | 100% | 43.75% | 2 | 47 |
| tonsil_child | 60637 | PARTIAL | 100% | 100% | 100% | 31.25% | 0 | 83 |
| tonsil | 94303 | PARTIAL | 90% | 100% | 100% | 50% | 2 | 44 |
| tonsil | 60637 | PARTIAL | 100% | 100% | 100% | 27.78% | 0 | 80 |

### Ophthalmology

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| cataract | 94303 | PARTIAL | 90% | 100% | 100% | 6.25% | 2 | 45 |
| cataract | 60637 | PASS | 95% | 100% | 100% | 55.56% | 1 | 78 |

### Pulmonary

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| bronchoscopy | 94303 | PARTIAL | 100% | 100% | 100% | 29.41% | 0 | 44 |
| bronchoscopy | 60637 | PARTIAL | 95% | 100% | 100% | 11.11% | 1 | 82 |

### Neurology

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| carpal_tunnel | 94303 | PARTIAL | 90% | 100% | 100% | 62.5% | 2 | 44 |
| carpal_tunnel | 60637 | PARTIAL | 100% | 100% | 100% | 38.89% | 0 | 79 |

### Diagnostic

| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |
|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|
| fna_biopsy | 94303 | PARTIAL | 94.44% | 100% | 100% | 37.5% | 1 | 47 |
| fna_biopsy | 60637 | PARTIAL | 88.24% | 100% | 100% | 7.14% | 2 | 84 |
| breast_biopsy | 94303 | PARTIAL | 94.12% | 100% | 100% | 50% | 1 | 49 |
| breast_biopsy | 60637 | PASS | 100% | 100% | 100% | 47.06% | 0 | 79 |

## Top 20 Gaps

1. **shoulder_arthro** @ 94303 — PARTIAL (85% provider, 100% package)
   - Missing: kaiser san mateo, kaiser santa clara, kaiser san rafael
   - Extra: san jose ambulatory, novamed surgery center san jose, uspi san francisco, san francisco ambulatory, amsurg san francisco (+34 more)
2. **lap_ovary** @ 94303 — PARTIAL (85% provider, 100% package)
   - Missing: kaiser san jose, kaiser san rafael, kaiser santa clara
   - Extra: valley, saint francis, san ramon regional, california pacific medical center- van ness campus, sutter delta (+27 more)
3. **lap_ovary** @ 60637 — PARTIAL (85% provider, 100% package)
   - Missing: thorek memorial andersonville, insight hospital chicago, ascension saint joseph chicago
   - Extra: west suburban, weiss memorial, swedish, gottlieb memorial, northwest health porter (+58 more)
4. **fna_biopsy** @ 60637 — PARTIAL (88.24% provider, 100% package)
   - Missing: uchicago medicine ingalls memorial, franciscan health dyer
   - Extra: novamed surgery center chicago, amsurg chicago, loretto, community first, sca health surgery center chicago (+79 more)
5. **finger_fracture** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san jose, kaiser san rafael
   - Extra: valley, saint francis, regional medical center san jose, san ramon regional, california pacific medical center- van ness campus (+26 more)
6. **knee_arthro** @ 60637 — PARTIAL (90% provider, 100% package)
   - Missing: thorek memorial andersonville, ascension saint joseph chicago
   - Extra: novamed surgery center chicago, sca health surgery center chicago, west suburban, ambulatory surgical center chicago, weiss memorial (+60 more)
7. **shoulder_arthro** @ 60637 — PARTIAL (90% provider, 100% package)
   - Missing: thorek memorial andersonville, ascension saint joseph chicago
   - Extra: novamed surgery center chicago, sca health surgery center chicago, west suburban, ambulatory surgical center chicago, weiss memorial (+60 more)
8. **colonoscopy_stoma** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san rafael, kaiser santa clara
   - Extra: san jose surgical associates, san jose ambulatory, novamed surgery center san jose, uspi san francisco, san francisco ambulatory (+42 more)
9. **hernia_lap** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san rafael, kaiser santa clara
   - Extra: san jose surgical associates, novamed surgery center san jose, uspi san francisco, san francisco ambulatory, amsurg san francisco (+40 more)
10. **tonsil_child** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser santa clara, kaiser san rafael
   - Extra: san jose surgical associates, san jose day, san francisco outpatient, san jose ambulatory, novamed surgery center san jose (+42 more)
11. **tonsil** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san rafael, kaiser santa clara
   - Extra: san jose ambulatory, novamed surgery center san jose, san francisco ambulatory, amsurg san francisco, sca health surgery center san jose (+39 more)
12. **cataract** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san rafael, kaiser santa clara
   - Extra: san jose surgical associates, san francisco outpatient, novamed surgery center san jose, uspi san francisco, amsurg san jose (+40 more)
13. **carpal_tunnel** @ 94303 — PARTIAL (90% provider, 100% package)
   - Missing: kaiser san rafael, kaiser santa clara
   - Extra: san jose surgical associates, novamed surgery center san jose, uspi san francisco, san francisco ambulatory, amsurg san francisco (+39 more)
14. **ankle_arthro** @ 94303 — PARTIAL (94.12% provider, 100% package)
   - Missing: kaiser san rafael
   - Extra: san jose day, san francisco outpatient, san jose ambulatory, novamed surgery center san jose, sca health surgery center san jose (+34 more)
15. **breast_mri** @ 94303 — PARTIAL (94.12% provider, 100% package)
   - Missing: el camino health los gatos
   - Extra: san jose day, sutter maternity surgery center santa cruz, ucsf benioff childrens oakland, lucile salter packard childrens hsp stanford, kaiser oakland (+36 more)
16. **breast_biopsy** @ 94303 — PARTIAL (94.12% provider, 100% package)
   - Missing: el camino health mountain view
   - Extra: san jose surgical associates, uspi san jose, san francisco outpatient, san jose ambulatory, uspi san francisco (+44 more)
17. **finger_fracture** @ 60637 — PARTIAL (94.44% provider, 100% package)
   - Missing: south shore
   - Extra: swedish, saint joseph chicago, northwest health porter, franciscan health olympia chicago heights, humboldt park (+58 more)
18. **breast_mri** @ 60637 — PARTIAL (94.44% provider, 100% package)
   - Missing: franciscan health dyer
   - Extra: amsurg chicago, loretto, larabida childrens hospital, community first, west suburban (+77 more)
19. **ultrasound** @ 94303 — PARTIAL (94.44% provider, 100% package)
   - Missing: el camino health los gatos
   - Extra: uspi san jose, san jose ambulatory, novamed surgery center san jose, amsurg san jose, kaiser permanente (+45 more)
20. **egd** @ 94303 — PARTIAL (94.44% provider, 100% package)
   - Missing: kaiser san rafael
   - Extra: uspi san jose, san jose day, san jose ambulatory, novamed surgery center san jose, amsurg san francisco (+44 more)
