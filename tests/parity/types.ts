export interface Provider {
  name: string;
  city?: string;
  state?: string;
  distance?: number;
  cmsStars?: number;
  tier?: string;
  estimatedOop?: number;
  cashPrice?: number;
  negotiatedRate?: number;
  networkStatus?: string;
  verificationSource?: string;
}

export interface PackageRow {
  code: string;
  codeType: string;
  description: string;
  cost?: number;
}

export interface CategoryResult {
  category: string;
  procedureId: string;
  procedureName: string;
  zip: string;
  providers: Provider[];
  packages: PackageRow[];
  procedures: string[];
  rawHtml?: string;
  screenshotPath?: string;
  timestamp: string;
}

export interface NormalizedProvider {
  normalizedName: string;
  originalName: string;
  city?: string;
  state?: string;
  rank: number;
  networkStatus?: string;
  negotiatedRate?: number;
  estimatedOop?: number;
}

export interface NormalizedResult {
  category: string;
  procedureId: string;
  zip: string;
  providers: NormalizedProvider[];
  packages: string[];
  procedures: string[];
}

export interface DiffEntry {
  category: string;
  procedureId: string;
  zip: string;
  missingProviders: string[];
  extraProviders: string[];
  matchedProviders: string[];
  rankingDiffs: Array<{
    provider: string;
    turquoiseRank: number;
    anacareRank: number;
    delta: number;
  }>;
  missingPackages: string[];
  extraPackages: string[];
  missingProcedures: string[];
  extraProcedures: string[];
  providerParity: number;
  packageParity: number;
  networkParity: number;
  pricingBallparkParity: number;
  status: "PASS" | "FAIL" | "PARTIAL" | "BLOCKED";
}

export interface ParitySummary {
  totalTests: number;
  passed: number;
  failed: number;
  partial: number;
  blocked: number;
  overallProviderParity: number;
  overallPackageParity: number;
  overallNetworkParity: number;
  overallPricingBallparkParity: number;
  overallRankingAlignment: number;
  diffs: DiffEntry[];
}

export const TEST_ZIPS = ["94303", "60637"];

export const TURQUOISE_BASE_URL = "https://turquoise.health/patients";

export const ANACARE_CATEGORIES: Record<string, string[]> = {
  Musculoskeletal: [
    "ankle_arthro",
    "finger_fracture",
    "clavicle_repair",
    "wrist_repair",
    "hip_arthro",
    "knee_arthro",
    "shoulder_arthro",
  ],
  "Radiology & Imaging": [
    "breast_mri",
    "breast_ultrasound",
    "ct",
    "ct_abdomen_pelvis",
    "fetal_mri",
    "mammogram",
    "mri_contrast",
    "mri_no_contrast",
    "ultrasound",
    "xray",
  ],
  Gastrointestinal: [
    "colonoscopy",
    "colonoscopy_stoma",
    "egd",
    "hernia_lap",
    "hernia_open",
  ],
  Obstetrics: ["cesarean", "vaginal_delivery"],
  Reproductive: ["hysteroscopy", "lap_ovary"],
  ENT: ["tonsil_child", "tonsil"],
  Ophthalmology: ["cataract"],
  Pulmonary: ["bronchoscopy"],
  Neurology: ["carpal_tunnel"],
  Diagnostic: ["fna_biopsy", "breast_biopsy"],
};

// Map AnaCare procedure IDs to likely Turquoise search terms
export const PROCEDURE_SEARCH_TERMS: Record<string, string> = {
  ankle_arthro: "ankle arthroscopy",
  finger_fracture: "finger fracture repair",
  clavicle_repair: "clavicle repair",
  wrist_repair: "wrist repair",
  hip_arthro: "hip arthroscopy",
  knee_arthro: "knee arthroscopy",
  shoulder_arthro: "shoulder arthroscopy",
  breast_mri: "breast MRI",
  breast_ultrasound: "breast ultrasound",
  ct: "CT scan",
  ct_abdomen_pelvis: "CT abdomen pelvis",
  fetal_mri: "fetal MRI",
  mammogram: "mammogram",
  mri_contrast: "MRI with contrast",
  mri_no_contrast: "MRI without contrast",
  ultrasound: "ultrasound",
  xray: "x-ray",
  colonoscopy: "colonoscopy",
  colonoscopy_stoma: "colonoscopy via stoma",
  egd: "upper endoscopy",
  hernia_lap: "hernia repair laparoscopic",
  hernia_open: "hernia repair",
  cesarean: "cesarean delivery",
  vaginal_delivery: "vaginal delivery",
  hysteroscopy: "hysteroscopy",
  lap_ovary: "laparoscopic ovarian surgery",
  tonsil_child: "tonsillectomy child",
  tonsil: "tonsillectomy",
  cataract: "cataract surgery",
  bronchoscopy: "bronchoscopy",
  carpal_tunnel: "carpal tunnel",
  fna_biopsy: "fine needle aspiration biopsy",
  breast_biopsy: "breast biopsy",
};
