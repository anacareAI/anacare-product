import * as fs from "fs";
import * as path from "path";
import {
  type CategoryResult,
  type Provider,
  type PackageRow,
  TEST_ZIPS,
  ANACARE_CATEGORIES,
} from "../types";

const RAW_DIR = path.resolve(__dirname, "raw");
const DATA_DIR = path.resolve(__dirname, "..", "..", "..", "frontend", "src", "data");

// ZIP → lat/lng coordinates
const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  "94303": { lat: 37.4419, lng: -122.1430 },
  "60637": { lat: 41.7800, lng: -87.5936 },
};

// Load JSON data files
const hospitals: any[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "hospitals.json"), "utf-8")
);
const basePrices: Record<string, any> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "basePrices.json"), "utf-8")
);
const proceduresData: any = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "procedures.json"), "utf-8")
);

const TIER_ADJ: Record<number, number> = { 1: 1.1, 2: 1.0, 3: 0.88 };

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPrice(hospital: any, procedureId: string) {
  const b = basePrices[procedureId];
  if (!b) return null;
  const randAdj = (hospital.rand_multiplier || 1.8) / 1.8;
  const tierAdj = TIER_ADJ[hospital.tier as number] || 1.0;
  const m = randAdj * tierAdj;
  return {
    gross: Math.round(b.gross * m),
    negotiated: Math.round(b.negotiated * m),
    cash: Math.round(b.cash * m),
    facility: b.facility,
    surgeon: b.surgeon,
    anesthesia: b.anesthesia,
    implant: b.implant,
  };
}

function findHospitals(procedureId: string, lat: number, lng: number, radiusMiles: number) {
  const matching = hospitals.filter((h) => h.procedures?.includes(procedureId));

  let results = matching
    .map((h) => {
      const dist = haversine(lat, lng, h.lat, h.lng);
      const price = getPrice(h, procedureId);
      if (!price) return null;

      return {
        ...h,
        distance: Math.round(dist * 10) / 10,
        price,
        cashPrice: price.cash,
      };
    })
    .filter(Boolean)
    .filter((r: any) => r.distance <= radiusMiles);

  results.sort((a: any, b: any) => a.price.cash - b.price.cash);
  return results;
}

function searchProcedure(procedureId: string, zip: string): CategoryResult {
  const category =
    Object.entries(ANACARE_CATEGORIES).find(([, procs]) =>
      procs.includes(procedureId)
    )?.[0] || "Unknown";

  const procInfo = proceduresData.procedures[procedureId];
  const coords = ZIP_COORDS[zip];

  const result: CategoryResult = {
    category,
    procedureId,
    procedureName: procInfo?.name || procedureId,
    zip,
    providers: [],
    packages: [],
    procedures: [procInfo?.name || procedureId],
    timestamp: new Date().toISOString(),
  };

  if (!coords) {
    console.warn(`No coordinates for ZIP ${zip}`);
    return result;
  }

  const hospitalResults = findHospitals(procedureId, coords.lat, coords.lng, 50);

  result.providers = hospitalResults.map((h: any) => ({
    name: h.name,
    city: h.city,
    state: h.state,
    distance: h.distance,
    cmsStars: h.cms_stars,
    tier: `Tier ${h.tier}`,
    estimatedOop: h.price.negotiated,
    cashPrice: h.cashPrice,
    negotiatedRate: h.price.negotiated,
    networkStatus: "unknown",
  }));

  // Build package rows (mirroring backend package_bundle.py logic)
  const bp = basePrices[procedureId];
  if (bp) {
    result.packages = [
      { code: "", codeType: "bundle", description: "Facility Fee", cost: bp.facility },
      { code: "", codeType: "bundle", description: "Surgeon/Professional Fee", cost: bp.surgeon },
      { code: "", codeType: "bundle", description: "Anesthesia", cost: bp.anesthesia },
    ];
    if (bp.implant > 0) {
      result.packages.push({
        code: "",
        codeType: "bundle",
        description: "Implant",
        cost: bp.implant,
      });
    }
  }

  return result;
}

export async function crawlAnaCare(): Promise<CategoryResult[]> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const results: CategoryResult[] = [];

  let count = 0;
  const total = Object.values(ANACARE_CATEGORIES).flat().length * TEST_ZIPS.length;

  for (const [category, procedureIds] of Object.entries(ANACARE_CATEGORIES)) {
    for (const procId of procedureIds) {
      for (const zip of TEST_ZIPS) {
        count++;
        console.log(`[${count}/${total}] ${procId} @ ${zip}`);

        const result = searchProcedure(procId, zip);
        results.push(result);

        fs.writeFileSync(
          path.join(RAW_DIR, `${procId}_${zip}.json`),
          JSON.stringify(result, null, 2)
        );
      }
    }
  }

  const withProviders = results.filter((r) => r.providers.length > 0);
  console.log(`\nDone: ${results.length} total, ${withProviders.length} with providers`);
  return results;
}

if (require.main === module) {
  crawlAnaCare().catch(console.error);
}
