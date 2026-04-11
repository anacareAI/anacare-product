"""
episode_costs.py

Defines the EPISODE_COSTS data structure for all 33 Turquoise Health procedures.
Each entry decomposes a service into pre-op, surgery/procedure, and post-op phases
with itemized CPT codes, costs, and visit counts.
"""

EPISODE_COSTS = {
    # ── Musculoskeletal ──────────────────────────────────────────────────
    "ankle_repair_arthroscopic": {
        "proc_id": "ankle_repair_arthroscopic",
        "display_name": "Ankle Repair - Arthroscopic",
        "cpt_primary": "29898",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 8000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Ankle MRI", "cpt": "73721", "cost": 850, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Physical Therapy", "cpt": "97110", "cost": 2480, "sessions": 16, "cost_per_session": 155},
            {"name": "Post-op X-ray", "cpt": "73600", "cost": 120, "visits": 2},
            {"name": "Walking Boot", "hcpcs": "L4361", "cost": 120, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "finger_fracture_repair": {
        "proc_id": "finger_fracture_repair",
        "display_name": "Articular Finger Fracture Repair - Surgical",
        "cpt_primary": "26615",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 3000,
        "implant_cost": 800,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Hand X-ray", "cpt": "73140", "cost": 85, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op X-ray", "cpt": "73140", "cost": 85, "visits": 2},
            {"name": "Hand Therapy", "cpt": "97530", "cost": 1240, "sessions": 8, "cost_per_session": 155},
            {"name": "Splint", "hcpcs": "L3933", "cost": 65, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "clavicle_scapula_repair": {
        "proc_id": "clavicle_scapula_repair",
        "display_name": "Clavicle/Scapula Repair - Non-Surgical",
        "cpt_primary": "23500",
        "complication_risk_field": None,
        "complication_cost_avg": 1000,
        "implant_cost": 0,
        "preop": [
            {"name": "Physician Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Shoulder X-ray", "cpt": "73030", "cost": 85, "visits": 1},
        ],
        "postop": [
            {"name": "Follow-up X-ray", "cpt": "73030", "cost": 85, "visits": 2},
            {"name": "Shoulder Sling", "hcpcs": "L3670", "cost": 65, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "forearm_wrist_repair": {
        "proc_id": "forearm_wrist_repair",
        "display_name": "Forearm/Wrist Repair - Non-Surgical",
        "cpt_primary": "25600",
        "complication_risk_field": None,
        "complication_cost_avg": 1000,
        "implant_cost": 0,
        "preop": [
            {"name": "Physician Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Wrist X-ray", "cpt": "73110", "cost": 85, "visits": 1},
        ],
        "postop": [
            {"name": "Follow-up X-ray", "cpt": "73110", "cost": 85, "visits": 2},
            {"name": "Cast/Splint", "hcpcs": "L3933", "cost": 85, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "hip_repair_arthroscopic": {
        "proc_id": "hip_repair_arthroscopic",
        "display_name": "Hip Repair - Arthroscopic",
        "cpt_primary": "29916",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 9000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Hip MRI", "cpt": "73721", "cost": 850, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Physical Therapy", "cpt": "97110", "cost": 2790, "sessions": 18, "cost_per_session": 155},
            {"name": "Post-op X-ray", "cpt": "73502", "cost": 120, "visits": 2},
            {"name": "Crutches", "hcpcs": "E0110", "cost": 65, "visits": 1},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "knee_repair_arthroscopic": {
        "proc_id": "knee_repair_arthroscopic",
        "display_name": "Knee Repair - Arthroscopic",
        "cpt_primary": "29881",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 5000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Knee MRI", "cpt": "73721", "cost": 850, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Physical Therapy", "cpt": "97110", "cost": 1860, "sessions": 12, "cost_per_session": 155},
            {"name": "Post-op X-ray", "cpt": "73560", "cost": 120, "visits": 2},
            {"name": "Knee Brace", "hcpcs": "L1820", "cost": 95, "visits": 1},
            {"name": "Crutches", "hcpcs": "E0110", "cost": 65, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "shoulder_repair_arthroscopic": {
        "proc_id": "shoulder_repair_arthroscopic",
        "display_name": "Shoulder Repair, Complex - Arthroscopic",
        "cpt_primary": "29827",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 7000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Shoulder MRI", "cpt": "73221", "cost": 750, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Physical Therapy", "cpt": "97110", "cost": 2480, "sessions": 16, "cost_per_session": 155},
            {"name": "Post-op X-ray", "cpt": "73030", "cost": 120, "visits": 2},
            {"name": "Shoulder Sling", "hcpcs": "L3670", "cost": 65, "visits": 1},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Radiology & Imaging ──────────────────────────────────────────────
    "breast_mri": {
        "proc_id": "breast_mri",
        "display_name": "Breast MRI",
        "cpt_primary": "77049",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "breast_ultrasound": {
        "proc_id": "breast_ultrasound",
        "display_name": "Breast Ultrasound",
        "cpt_primary": "76641",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "ct_scan": {
        "proc_id": "ct_scan",
        "display_name": "CT",
        "cpt_primary": "70553",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "ct_abdomen_pelvis": {
        "proc_id": "ct_abdomen_pelvis",
        "display_name": "CT of Abdomen and Pelvis",
        "cpt_primary": "74177",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "fetal_mri": {
        "proc_id": "fetal_mri",
        "display_name": "Fetal MRI",
        "cpt_primary": "74712",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "mammogram": {
        "proc_id": "mammogram",
        "display_name": "Mammogram",
        "cpt_primary": "77067",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "mri_with_contrast": {
        "proc_id": "mri_with_contrast",
        "display_name": "MRI with Contrast",
        "cpt_primary": "70553",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "mri_without_contrast": {
        "proc_id": "mri_without_contrast",
        "display_name": "MRI without Contrast",
        "cpt_primary": "70551",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "ultrasound": {
        "proc_id": "ultrasound",
        "display_name": "Ultrasound",
        "cpt_primary": "76700",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },
    "xray": {
        "proc_id": "xray",
        "display_name": "X-Ray",
        "cpt_primary": "71046",
        "complication_risk_field": None,
        "complication_cost_avg": 0,
        "implant_cost": 0,
        "preop": [],
        "postop": [],
    },

    # ── Gastrointestinal ─────────────────────────────────────────────────
    "colonoscopy": {
        "proc_id": "colonoscopy",
        "display_name": "Colonoscopy",
        "cpt_primary": "45378",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 3500,
        "implant_cost": 0,
        "preop": [
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Bowel Prep (PEG)", "cpt": "rx", "cost": 35, "fills": 1, "rx_tier": 1},
        ],
    },
    "colonoscopy_via_stoma": {
        "proc_id": "colonoscopy_via_stoma",
        "display_name": "Colonoscopy via Stoma",
        "cpt_primary": "44388",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 4000,
        "implant_cost": 0,
        "preop": [
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Bowel Prep (PEG)", "cpt": "rx", "cost": 35, "fills": 1, "rx_tier": 1},
        ],
    },
    "egd_simple": {
        "proc_id": "egd_simple",
        "display_name": "Esophagogastroduodenoscopy, Simple",
        "cpt_primary": "43235",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 2500,
        "implant_cost": 0,
        "preop": [
            {"name": "Physician Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [],
    },
    "hernia_repair_laparoscopic": {
        "proc_id": "hernia_repair_laparoscopic",
        "display_name": "Hernia Repair - Laparoscopic",
        "cpt_primary": "49650",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 5000,
        "implant_cost": 800,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "hernia_repair_open": {
        "proc_id": "hernia_repair_open",
        "display_name": "Hernia Repair - Non-Laparoscopic",
        "cpt_primary": "49505",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 4000,
        "implant_cost": 800,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Obstetrics ────────────────────────────────────────────────────────
    "cesarean_delivery": {
        "proc_id": "cesarean_delivery",
        "display_name": "Delivery - Cesarean",
        "cpt_primary": "59510",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 12000,
        "implant_cost": 0,
        "preop": [
            {"name": "OB Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Fetal Ultrasound", "cpt": "76805", "cost": 350, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
            {"name": "Blood Type & Screen", "cpt": "86900", "cost": 60, "visits": 1},
            {"name": "EKG", "cpt": "93000", "cost": 85, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 2},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "vaginal_delivery": {
        "proc_id": "vaginal_delivery",
        "display_name": "Delivery - Vaginal",
        "cpt_primary": "59400",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 6000,
        "implant_cost": 0,
        "preop": [
            {"name": "OB Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Fetal Ultrasound", "cpt": "76805", "cost": 350, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
            {"name": "Blood Type & Screen", "cpt": "86900", "cost": 60, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Reproductive ─────────────────────────────────────────────────────
    "hysteroscopy_surgical": {
        "proc_id": "hysteroscopy_surgical",
        "display_name": "Hysteroscopy with Surgical Procedure",
        "cpt_primary": "58558",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 4000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Pelvic Ultrasound", "cpt": "76856", "cost": 350, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },
    "laparoscopic_ovary_surgery": {
        "proc_id": "laparoscopic_ovary_surgery",
        "display_name": "Laparoscopic Surgery of Ovaries and/or Fallopian Tubes",
        "cpt_primary": "58661",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 6000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Pelvic Ultrasound", "cpt": "76856", "cost": 350, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 2},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── ENT ───────────────────────────────────────────────────────────────
    "tonsil_adenoid_child": {
        "proc_id": "tonsil_adenoid_child",
        "display_name": "Tonsil and Adenoid Removal (Child Under 12)",
        "cpt_primary": "42820",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 3000,
        "implant_cost": 0,
        "preop": [
            {"name": "ENT Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99213", "cost": 180, "visits": 1},
            {"name": "Acetaminophen", "cpt": "rx", "cost": 8, "fills": 1, "rx_tier": 1},
            {"name": "Amoxicillin", "cpt": "rx", "cost": 12, "fills": 1, "rx_tier": 1},
        ],
    },
    "tonsil_adenoid_removal": {
        "proc_id": "tonsil_adenoid_removal",
        "display_name": "Tonsil and/or Adenoid Removal",
        "cpt_primary": "42826",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 3500,
        "implant_cost": 0,
        "preop": [
            {"name": "ENT Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99213", "cost": 180, "visits": 1},
            {"name": "Oxycodone", "cpt": "rx", "cost": 45, "fills": 1, "rx_tier": 1},
            {"name": "Amoxicillin", "cpt": "rx", "cost": 12, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Ophthalmology ─────────────────────────────────────────────────────
    "cataract_removal": {
        "proc_id": "cataract_removal",
        "display_name": "Cataract Removal with Intraocular Lens Insertion",
        "cpt_primary": "66984",
        "complication_risk_field": None,
        "complication_cost_avg": 1500,
        "implant_cost": 1200,
        "preop": [
            {"name": "Eye Exam", "cpt": "92014", "cost": 180, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99213", "cost": 180, "visits": 2},
            {"name": "Eye Drops", "cpt": "rx", "cost": 25, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Pulmonary ─────────────────────────────────────────────────────────
    "bronchoscopy": {
        "proc_id": "bronchoscopy",
        "display_name": "Bronchoscopy",
        "cpt_primary": "31622",
        "complication_risk_field": "PSI_11",
        "complication_cost_avg": 3000,
        "implant_cost": 0,
        "preop": [
            {"name": "Pulmonologist Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Chest X-ray", "cpt": "71046", "cost": 65, "visits": 1},
            {"name": "CBC", "cpt": "85025", "cost": 45, "visits": 1},
            {"name": "Metabolic Panel", "cpt": "80053", "cost": 120, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
        ],
    },

    # ── Neurology ─────────────────────────────────────────────────────────
    "carpal_tunnel_repair": {
        "proc_id": "carpal_tunnel_repair",
        "display_name": "Carpal Tunnel Repair",
        "cpt_primary": "64721",
        "complication_risk_field": None,
        "complication_cost_avg": 2000,
        "implant_cost": 0,
        "preop": [
            {"name": "Surgeon Consultation", "cpt": "99214", "cost": 280, "visits": 1},
        ],
        "postop": [
            {"name": "Post-op Visit", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Wrist Splint", "hcpcs": "L3933", "cost": 65, "visits": 1},
            {"name": "Ibuprofen", "cpt": "rx", "cost": 10, "fills": 1, "rx_tier": 1},
        ],
    },

    # ── Diagnostic ────────────────────────────────────────────────────────
    "fna_biopsy_ultrasound": {
        "proc_id": "fna_biopsy_ultrasound",
        "display_name": "Fine Needle Aspiration Biopsy with Ultrasound Guidance",
        "cpt_primary": "10005",
        "complication_risk_field": None,
        "complication_cost_avg": 500,
        "implant_cost": 0,
        "preop": [
            {"name": "Physician Consultation", "cpt": "99214", "cost": 280, "visits": 1},
        ],
        "postop": [
            {"name": "Pathology", "cpt": "88172", "cost": 250, "visits": 1},
            {"name": "Follow-up Visit", "cpt": "99214", "cost": 280, "visits": 1},
        ],
    },
    "percutaneous_breast_biopsy": {
        "proc_id": "percutaneous_breast_biopsy",
        "display_name": "Percutaneous Breast Biopsy",
        "cpt_primary": "19081",
        "complication_risk_field": None,
        "complication_cost_avg": 1000,
        "implant_cost": 0,
        "preop": [
            {"name": "Physician Consultation", "cpt": "99214", "cost": 280, "visits": 1},
            {"name": "Breast Imaging", "cpt": "77049", "cost": 650, "visits": 1},
        ],
        "postop": [
            {"name": "Pathology", "cpt": "88305", "cost": 300, "visits": 1},
            {"name": "Follow-up Visit", "cpt": "99214", "cost": 280, "visits": 1},
        ],
    },
}


def uses_operating_room_style_charges(episode: dict) -> bool:
    """
    True for episodes modeled with OR-style facility splits, anesthesia, and revenue lines.
    False for non-surgical management, standalone imaging, and other outpatient-style episodes.
    """
    explicit = episode.get("uses_operating_room_charges")
    if explicit is False:
        return False
    if explicit is True:
        return True
    dn = (episode.get("display_name") or "").lower()
    if "non-surgical" in dn:
        return False
    if (
        not episode.get("preop")
        and not episode.get("postop")
        and not (episode.get("implant_cost") or 0)
    ):
        return False
    return True
