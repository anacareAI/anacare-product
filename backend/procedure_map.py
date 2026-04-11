"""
Maps frontend ProcedureSelector IDs (procedures.json keys) to EPISODE_COSTS keys.
Updated to match Turquoise Health service catalog.
"""

FRONTEND_PROCEDURE_TO_EPISODE_KEY: dict[str, str] = {
    # Musculoskeletal
    "ankle_arthro": "ankle_repair_arthroscopic",
    "finger_fracture": "finger_fracture_repair",
    "clavicle_repair": "clavicle_scapula_repair",
    "wrist_repair": "forearm_wrist_repair",
    "hip_arthro": "hip_repair_arthroscopic",
    "knee_arthro": "knee_repair_arthroscopic",
    "shoulder_arthro": "shoulder_repair_arthroscopic",
    # Radiology & Imaging
    "breast_mri": "breast_mri",
    "breast_ultrasound": "breast_ultrasound",
    "ct": "ct_scan",
    "ct_abdomen_pelvis": "ct_abdomen_pelvis",
    "fetal_mri": "fetal_mri",
    "mammogram": "mammogram",
    "mri_contrast": "mri_with_contrast",
    "mri_no_contrast": "mri_without_contrast",
    "ultrasound": "ultrasound",
    "xray": "xray",
    # Gastrointestinal
    "colonoscopy": "colonoscopy",
    "colonoscopy_stoma": "colonoscopy_via_stoma",
    "egd": "egd_simple",
    "hernia_lap": "hernia_repair_laparoscopic",
    "hernia_open": "hernia_repair_open",
    # Obstetrics
    "cesarean": "cesarean_delivery",
    "vaginal_delivery": "vaginal_delivery",
    # Reproductive
    "hysteroscopy": "hysteroscopy_surgical",
    "lap_ovary": "laparoscopic_ovary_surgery",
    # ENT
    "tonsil_child": "tonsil_adenoid_child",
    "tonsil": "tonsil_adenoid_removal",
    # Ophthalmology
    "cataract": "cataract_removal",
    # Pulmonary
    "bronchoscopy": "bronchoscopy",
    # Neurology
    "carpal_tunnel": "carpal_tunnel_repair",
    # Diagnostic
    "fna_biopsy": "fna_biopsy_ultrasound",
    "breast_biopsy": "percutaneous_breast_biopsy",
}


def resolve_episode_key(procedure_id: str) -> str | None:
    if not procedure_id:
        return None
    return FRONTEND_PROCEDURE_TO_EPISODE_KEY.get(procedure_id)
