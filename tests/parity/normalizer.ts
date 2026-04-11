import * as fs from "fs";
import * as path from "path";
import {
  type CategoryResult,
  type NormalizedResult,
  type NormalizedProvider,
  ANACARE_CATEGORIES,
  TEST_ZIPS,
} from "./types";

// Words to strip for fuzzy matching (order matters: longer first)
const STRIP_SUFFIXES = [
  "and clinics",
  "health system",
  "healthcare system",
  "healthcare",
  "health care",
  "health",
  "medical centers",
  "medical center",
  "medical ctr",
  "med ctr",
  "surgery center",
  "surgical center",
  "hospital and medical center",
  "hospitals",
  "hospital",
  "hosp",
  "clinic",
  "center",
  "inc",
  "llc",
  "corp",
  "dba",
  "pllc",
  "lp",
];

const STRIP_PREFIXES = ["the", "a"];

const STRIP_WORDS = ["of", "at", "and", "&", "-", "–"];

// Known alias mappings: canonical → alternative forms
const ALIASES: Record<string, string[]> = {
  "stanford health care": ["stanford university hospital", "stanford hospital"],
  "uchicago medicine adventhealth glenoaks": [
    "uchicago medicine adventhealth glenoaks",
    "adventhealth glenoaks",
    "uchicago medicine adventhealth",
  ],
  "university of illinois hospital": [
    "university of illinois hospital and clinics",
    "uic hospital",
  ],
  "northwestern memorial": ["northwestern memorial hospital", "nm hospital"],
  "rush university medical center": ["rush medical center", "rush university"],
  "loyola university medical center": ["loyola medical center"],
  "ascension saint joseph chicago": [
    "saint joseph hospital chicago",
    "ascension st joseph",
    "saint joseph medical center",
  ],
  "el camino health": ["el camino hospital", "el camino health mountain view", "el camino health los gatos"],
  "kaiser permanente": ["kaiser"],
  "amita health resurrection": [
    "resurrection medical center",
    "resurrection",
    "amita health resurrection medical center",
  ],
  "provident hospital chicago": [
    "provident hospital of cook county",
    "provident hospital cook county",
    "provident hospital of chicago",
  ],
  "contra costa regional": [
    "contra costa regional medical center",
  ],
  "northwest health la porte": [
    "northwest health-la porte",
    "northwest health - la porte",
  ],
  "northwest health porter": [
    "northwest health - porter",
  ],
  "northwest health portage": [
    "northwest health - portage",
  ],
  "loyola medicine childrens": [
    "loyola medicine childrens hospital",
  ],
  "gottlieb memorial": [
    "gottlieb memorial hospital",
    "loyola gottlieb",
  ],
  "rush copley": [
    "rush copley medical center",
  ],
  "holy family": [
    "holy family medical center",
    "hshs holy family hospital",
    "osf holy family medical center",
  ],
  "saint mary nazareth": [
    "saint mary of nazareth hospital",
    "amita saint mary nazareth",
    "presence saint mary of nazareth",
  ],
  "saint mary kankakee": [
    "saint mary hospital kankakee",
    "st mary hospital kankakee",
    "ascension saint mary kankakee",
  ],
  // "san leandro" aliases are handled under "kaiser san leandro" below
  "ucsf medical center": [
    "ucsf medical center",
    "ucsf health",
  ],
  "ucsf benioff childrens oakland": [
    "ucsf benioff childrens hospital oakland",
  ],
  "ucsf benioff childrens san francisco": [
    "ucsf benioff childrens hospital san francisco",
  ],
  "ucsf helen diller parnassus": [
    "ucsf helen diller medical center parnassus heights",
    "ucsf medical center parnassus",
  ],
  "ucsf mount zion": [
    "ucsf medical center mount zion",
  ],
  "ucsf bakar cancer": [
    "ucsf bakar cancer hospital",
  ],
  "oconnor": [
    "oconnor hospital",
    "o'connor hospital",
  ],
  // Kaiser Permanente facilities (Turquoise lists by city name)
  "kaiser antioch": [
    "antioch medical center",
    "kaiser foundation hospital - antioch",
    "kaiser foundation hospital antioch",
  ],
  "kaiser fremont": [
    "fremont medical center",
    "kaiser foundation hospital - fremont",
    "kaiser foundation hospital fremont",
  ],
  "kaiser redwood city": [
    "redwood city medical center",
    "kaiser foundation hospital - redwood city",
    "kaiser foundation hospital redwood city",
  ],
  "kaiser oakland": [
    "oakland medical center",
    "kaiser foundation hospital - oakland",
    "kaiser foundation hospital - oakland/richmond",
    "kaiser foundation hospital oakland",
  ],
  "kaiser walnut creek": [
    "walnut creek medical center",
    "kaiser foundation hospital - walnut creek",
    "kaiser foundation hospital walnut creek",
  ],
  "kaiser san rafael": [
    "san rafael medical center",
    "kaiser foundation hospital san rafael",
    "kaiser foundation hospital - san rafael",
  ],
  "kaiser richmond": [
    "richmond medical center",
    "kaiser foundation hospital - richmond",
  ],
  "kaiser vallejo": [
    "vallejo medical center",
    "kaiser foundation hospital - vallejo",
    "adventist health vallejo",
  ],
  "kaiser san leandro": [
    "san leandro medical center",
    "san leandro hospital",
    "kaiser foundation hospital - san leandro",
  ],
  "kaiser south san francisco": [
    "south san francisco medical center",
    "kaiser foundation hospital - south san francisco",
  ],
  "kaiser san jose": [
    "san jose medical center",
    "kaiser foundation hospital - san jose",
  ],
  "kaiser san francisco": [
    "san francisco medical center",
    "kaiser foundation hospital - san francisco",
  ],
  "kaiser san mateo": [
    "san mateo medical center",
    "kaiser foundation hospital - san mateo",
  ],
  "st louise regional": [
    "st louise regional hospital",
    "saint louise regional hospital",
  ],
  "thorek memorial": [
    "thorek memorial hospital",
  ],
  "thorek memorial andersonville": [
    "thorek memorial hospital andersonville",
    "thorek memorial andersonville",
  ],
  "macneal": [
    "macneal hospital",
  ],
  "mercy aurora": [
    "mercy medical center aurora",
    "mercy medical center",
  ],
  "shriners childrens chicago": [
    "shriners childrens - chicago",
    "shriners hospitals for children chicago",
    "shriners hospitals for children northern calif",
  ],
  "john muir walnut creek": [
    "john muir health - walnut creek medical center",
    "john muir medical center - walnut creek campus",
    "john muir walnut creek",
  ],
  "john muir concord": [
    "john muir health - concord medical center",
    "john muir medical center - concord campus",
    "john muir health concord",
  ],
  "ahmc seton coastside": [
    "ahmc seton medical center coastside",
    "ahmc seton medical center",
  ],
  "st rose": [
    "st rose hospital",
  ],
  "lucile packard childrens stanford": [
    "lucile packard childrens hospital stanford",
    "lucile packard children hospital",
  ],
  "saint anthony chicago": [
    "saint anthony hospital",
    "saint anthony hospital chicago",
  ],
  "john h stroger jr": [
    "john h stroger jr hospital of cook county",
    "john h stroger jr hospital cook county",
    "john h. stroger, jr. hospital of cook county",
    "john h stroger jr",
  ],
  "kaiser santa clara": [
    "santa clara medical center",
    "kaiser foundation hospital - santa clara",
  ],
  "elmhurst": [
    "elmhurst hospital",
    "edward elmhurst health",
  ],
  "saint joseph chicago": [
    "saint joseph",
    "saint joseph medical center",
    "presence saint joseph hospital chicago",
  ],
  "saint francis": [
    "saint francis hospital",
    "saint francis hospital-evanston",
  ],
  "st mary": [
    "st mary hospital",
    "saint mary hospital",
  ],
  "franciscan health dyer": [
    "franciscan health dyer",
  ],
  // Additional matching fixes
  "evanston": [
    "northshore university healthsystem - evanston hospital",
    "evanston hospital",
  ],
  "humboldt park": [
    "humboldt park health",
  ],
  "weiss memorial": [
    "louis a weiss memorial hospital",
    "weiss memorial hospital",
  ],
  "west suburban": [
    "west suburban medical center",
  ],
  "insight hospital chicago": [
    "insight hospital and medical center chicago",
    "insight hospital medical center chicago",
    "insight hospital & medical center chicago",
  ],
  "south shore": [
    "south shore hospital",
  ],
};

export function normalizeProviderName(name: string): string {
  let n = name.toLowerCase().trim();

  // Remove punctuation except hyphens
  n = n.replace(/[.,;:!?()"']/g, "");

  // Normalize whitespace
  n = n.replace(/\s+/g, " ").trim();

  // Check aliases — prefer longest (most specific) match
  let bestAlias = "";
  let bestAliasLen = 0;
  for (const [canonical, alts] of Object.entries(ALIASES)) {
    if (n === canonical) {
      bestAlias = canonical;
      bestAliasLen = n.length;
      break;
    }
    for (const alt of alts) {
      if ((n === alt || n.includes(alt)) && alt.length > bestAliasLen) {
        bestAlias = canonical;
        bestAliasLen = alt.length;
      }
    }
  }
  if (bestAlias) return bestAlias;

  // Strip prefixes
  for (const prefix of STRIP_PREFIXES) {
    if (n.startsWith(prefix + " ")) {
      n = n.substring(prefix.length + 1).trim();
    }
  }

  // Strip suffixes (from longest to shortest to avoid partial matches)
  for (const suffix of STRIP_SUFFIXES) {
    if (n.endsWith(" " + suffix)) {
      n = n.substring(0, n.length - suffix.length - 1).trim();
    }
  }

  // Remove isolated filler words
  const words = n.split(" ");
  const filtered = words.filter((w) => !STRIP_WORDS.includes(w));
  n = filtered.join(" ").replace(/\s+/g, " ").trim();

  // Remove trailing "i" or "ii" (roman numerals for campuses)
  n = n.replace(/\s+i+$/i, "").trim();

  return n;
}

// Fuzzy match score (0-1, higher = better match)
function fuzzyScore(a: string, b: string): number {
  if (a === b) return 1.0;

  // One contains the other
  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length >= b.length ? a : b;
    return shorter.length / longer.length;
  }

  // Word overlap (Jaccard similarity)
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.length / union.size;
}

export function findBestMatch(
  name: string,
  candidates: string[]
): { match: string; score: number } | null {
  let bestMatch = "";
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = fuzzyScore(name, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  // Threshold: at least 0.5 similarity
  return bestScore >= 0.5 ? { match: bestMatch, score: bestScore } : null;
}

export function deduplicateProviders(
  providers: NormalizedProvider[]
): NormalizedProvider[] {
  const seen = new Map<string, NormalizedProvider>();

  for (const p of providers) {
    const existing = seen.get(p.normalizedName);
    if (!existing || p.rank < existing.rank) {
      seen.set(p.normalizedName, p);
    }
  }

  return Array.from(seen.values());
}

export function normalizeResult(raw: CategoryResult): NormalizedResult {
  const normalizedProviders: NormalizedProvider[] = raw.providers.map(
    (p, index) => ({
      normalizedName: normalizeProviderName(p.name),
      originalName: p.name,
      city: p.city,
      state: p.state,
      rank: index + 1,
      networkStatus: (p.networkStatus || "unknown").toLowerCase(),
      negotiatedRate: p.negotiatedRate,
      estimatedOop: p.estimatedOop,
    })
  );

  return {
    category: raw.category,
    procedureId: raw.procedureId,
    zip: raw.zip,
    providers: deduplicateProviders(normalizedProviders),
    packages: raw.packages.map((p) => p.description.toLowerCase().trim()),
    procedures: raw.procedures.map((p) => p.toLowerCase().trim()),
  };
}

export function loadAndNormalize(
  rawDir: string
): Map<string, NormalizedResult> {
  const results = new Map<string, NormalizedResult>();

  for (const [, procedureIds] of Object.entries(ANACARE_CATEGORIES)) {
    for (const procId of procedureIds) {
      for (const zip of TEST_ZIPS) {
        const filename = `${procId}_${zip}.json`;
        const filepath = path.join(rawDir, filename);

        if (fs.existsSync(filepath)) {
          const raw: CategoryResult = JSON.parse(
            fs.readFileSync(filepath, "utf-8")
          );
          const normalized = normalizeResult(raw);
          results.set(`${procId}_${zip}`, normalized);
        }
      }
    }
  }

  return results;
}

export function runNormalization() {
  const baseDir = path.resolve(__dirname);

  const turquoiseRaw = path.join(baseDir, "turquoise", "raw");
  const anacareRaw = path.join(baseDir, "anacare", "raw");

  const turquoiseNormalized = loadAndNormalize(turquoiseRaw);
  const anacareNormalized = loadAndNormalize(anacareRaw);

  // Save normalized outputs
  const reportsDir = path.join(baseDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const turqOut: Record<string, NormalizedResult> = {};
  turquoiseNormalized.forEach((v, k) => (turqOut[k] = v));

  const anaOut: Record<string, NormalizedResult> = {};
  anacareNormalized.forEach((v, k) => (anaOut[k] = v));

  fs.writeFileSync(
    path.join(reportsDir, "normalized_turquoise.json"),
    JSON.stringify(turqOut, null, 2)
  );

  fs.writeFileSync(
    path.join(reportsDir, "normalized_anacare.json"),
    JSON.stringify(anaOut, null, 2)
  );

  console.log(
    `Normalized: ${turquoiseNormalized.size} Turquoise, ${anacareNormalized.size} AnaCare results`
  );

  return { turquoiseNormalized, anacareNormalized };
}

if (require.main === module) {
  runNormalization();
}
