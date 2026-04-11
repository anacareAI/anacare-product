# AnaCare vs Benchmark Reconciliation (Top 20)

Source: `tests/parity/reports/parity_summary.csv`

| Rank | Procedure | ZIP | Category | Gap Score | Provider % | Pricing % | Network % | Missing | Extra |
|------|-----------|-----|----------|-----------|------------|-----------|-----------|---------|-------|
| 1 | lap_ovary | 94303 | Reproductive | 40.79 | 85 | 6.25 | 100 | 3 | 32 |
| 2 | finger_fracture | 94303 | Musculoskeletal | 40.47 | 90 | 0 | 100 | 2 | 31 |
| 3 | fna_biopsy | 60637 | Diagnostic | 39.55 | 88.24 | 7.14 | 100 | 2 | 84 |
| 4 | colonoscopy | 60637 | Gastrointestinal | 38.72 | 95 | 0 | 100 | 1 | 81 |
| 5 | finger_fracture | 60637 | Musculoskeletal | 38.7 | 94.44 | 0 | 100 | 1 | 63 |
| 6 | cataract | 94303 | Ophthalmology | 38.49 | 90 | 6.25 | 100 | 2 | 45 |
| 7 | breast_ultrasound | 60637 | Radiology & Imaging | 36.2 | 100 | 0 | 100 | 0 | 80 |
| 8 | lap_ovary | 60637 | Reproductive | 35.94 | 85 | 21.43 | 100 | 3 | 63 |
| 9 | wrist_repair | 60637 | Musculoskeletal | 35.93 | 100 | 0 | 100 | 0 | 62 |
| 10 | cesarean | 94303 | Obstetrics | 35.65 | 100 | 0 | 100 | 0 | 43 |
| 11 | vaginal_delivery | 94303 | Obstetrics | 35.65 | 100 | 0 | 100 | 0 | 43 |
| 12 | bronchoscopy | 60637 | Pulmonary | 34.84 | 95 | 11.11 | 100 | 1 | 82 |
| 13 | fetal_mri | 60637 | Radiology & Imaging | 34.34 | 100 | 5.26 | 100 | 0 | 79 |
| 14 | colonoscopy_stoma | 60637 | Gastrointestinal | 34.33 | 100 | 5.26 | 100 | 0 | 78 |
| 15 | mammogram | 60637 | Radiology & Imaging | 34.31 | 100 | 5.88 | 100 | 0 | 91 |
| 16 | mri_no_contrast | 60637 | Radiology & Imaging | 34.25 | 100 | 5.56 | 100 | 0 | 80 |
| 17 | hernia_lap | 94303 | Gastrointestinal | 34.11 | 90 | 18.75 | 100 | 2 | 45 |
| 18 | vaginal_delivery | 60637 | Obstetrics | 33.03 | 95 | 15.38 | 100 | 1 | 61 |
| 19 | breast_mri | 60637 | Radiology & Imaging | 32.42 | 94.44 | 18.75 | 100 | 1 | 82 |
| 20 | mri_contrast | 60637 | Radiology & Imaging | 32.1 | 100 | 11.76 | 100 | 0 | 81 |

## Notes
- `Gap Score` prioritizes provider and pricing parity gaps first.
- This report is intended for weekly parity triage and remediation planning.
- Use procedure+zip rows above to drive focused parser/matching fixes.
