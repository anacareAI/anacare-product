import { chromium, type Page, type Browser } from "playwright";
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
const SCREENSHOT_DIR = path.resolve(__dirname, "..", "screenshots", "turquoise");

// Turquoise service codes mapped to AnaCare procedure IDs
const SERVICE_CODES: Record<string, string> = {
  ankle_arthro: "MS009",
  finger_fracture: "MS019",
  breast_mri: "RA011",
  breast_ultrasound: "RA012",
  bronchoscopy: "PU000",
  carpal_tunnel: "NU002",
  cataract: "OP000",
  clavicle_repair: "MS028",
  colonoscopy: "GA002",
  colonoscopy_stoma: "GA000",
  ct: "RA001",
  ct_abdomen_pelvis: "RA004",
  cesarean: "OB002",
  vaginal_delivery: "OB001",
  egd: "GA007",
  fetal_mri: "RA006",
  fna_biopsy: "DE003",
  wrist_repair: "MS010",
  hernia_lap: "GA010",
  hernia_open: "GA011",
  hip_arthro: "MS008",
  hysteroscopy: "RE003",
  knee_arthro: "MS006",
  lap_ovary: "RE004",
  mammogram: "RA010",
  mri_contrast: "RA007",
  mri_no_contrast: "RA005",
  breast_biopsy: "DE000",
  shoulder_arthro: "MS005",
  tonsil_child: "EN000",
  tonsil: "EN004",
  ultrasound: "RA008",
  xray: "RA000",
};

const PROCEDURE_NAMES: Record<string, string> = {
  ankle_arthro: "Ankle Repair - Arthroscopic",
  finger_fracture: "Articular Finger Fracture Repair - Surgical",
  breast_mri: "Breast MRI",
  breast_ultrasound: "Breast Ultrasound",
  bronchoscopy: "Bronchoscopy",
  carpal_tunnel: "Carpal Tunnel Repair",
  cataract: "Cataract Removal with Intraocular Lens Insertion",
  clavicle_repair: "Clavicle/Scapula Repair - Non-Surgical",
  colonoscopy: "Colonoscopy",
  colonoscopy_stoma: "Colonoscopy via Stoma",
  ct: "CT",
  ct_abdomen_pelvis: "CT of Abdomen and Pelvis",
  cesarean: "Delivery - Cesarean",
  vaginal_delivery: "Delivery - Vaginal",
  egd: "Esophagogastroduodenoscopy, Simple",
  fetal_mri: "Fetal MRI",
  fna_biopsy: "Fine Needle Aspiration Biopsy with Ultrasound Guidance",
  wrist_repair: "Forearm/Wrist Repair - Non-Surgical",
  hernia_lap: "Hernia Repair - Laparoscopic",
  hernia_open: "Hernia Repair - Non-Laparoscopic",
  hip_arthro: "Hip Repair - Arthroscopic",
  hysteroscopy: "Hysteroscopy with Surgical Procedure",
  knee_arthro: "Knee Repair - Arthroscopic",
  lap_ovary: "Laparoscopic Surgery of Ovaries and/or Fallopian Tubes",
  mammogram: "Mammogram",
  mri_contrast: "MRI with Contrast",
  mri_no_contrast: "MRI without Contrast",
  breast_biopsy: "Percutaneous Breast Biopsy",
  shoulder_arthro: "Shoulder Repair, Complex - Arthroscopic",
  tonsil_child: "Tonsil and Adenoid Removal (Child Under 12)",
  tonsil: "Tonsil and/or Adenoid Removal",
  ultrasound: "Ultrasound",
  xray: "X-Ray",
};

// ZIP → lat/lng for URL params (Turquoise requires lat/lng, not ZIP)
const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  "94303": { lat: 37.4419, lng: -122.1430 }, // Palo Alto, CA
  "60637": { lat: 41.7800, lng: -87.5936 }, // Chicago, IL (Hyde Park)
};

function ensureDirs() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseProviderFromRawText(rawText: string, _rank: number): Provider | null {
  // Parse using line-by-line segments (DOM structure uses \n between fields)
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return null;

  // Line 0: provider name (e.g., "Morris Hospital & Healthcare Centers")
  const name = lines[0];
  if (!name || name.length < 3) return null;

  // Line 1: facility type (e.g., "Hospital", "Childrens Hospital", "Surgery Center")
  // Lines after: city/state, distance, stars, price
  let city: string | undefined;
  let state: string | undefined;
  let distance: number | undefined;
  let stars: number | undefined;
  let price: number | undefined;
  let networkStatus: string | undefined;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // City, ST pattern
    const locMatch = line.match(/^([A-Za-z\s.'-]+),\s*([A-Z]{2})$/);
    if (locMatch) {
      city = locMatch[1].trim();
      state = locMatch[2];
      continue;
    }

    // Distance: "(49 mi)" or just "(49" followed by "mi)"
    const distMatch = line.match(/^\((\d+\.?\d*)/);
    if (distMatch) {
      distance = parseFloat(distMatch[1]);
      continue;
    }

    // Star rating: single digit line (1-5)
    if (/^[1-5]$/.test(line)) {
      stars = parseInt(line);
      continue;
    }

    // Price: "$1,234" or "up to"/"$X,XXX"
    const priceMatch = line.match(/^\$?([\d,]+)$/);
    if (priceMatch && !price) {
      price = parseInt(priceMatch[1].replace(/,/g, ""));
      continue;
    }
    if (/in network/i.test(line)) {
      networkStatus = "in_network";
      continue;
    }
    if (/out of network/i.test(line)) {
      networkStatus = "out_of_network";
      continue;
    }
  }

  return { name, city, state, distance, cmsStars: stars, estimatedOop: price, networkStatus };
}

async function extractProvidersFromPage(page: Page): Promise<Provider[]> {
  const providers: Provider[] = [];

  // Keep newlines intact for line-by-line parsing
  const rawTexts = await page.$$eval(".tqc-package-result-card", (cards) =>
    cards.map((card) => card.textContent || "")
  );

  for (let i = 0; i < rawTexts.length; i++) {
    const provider = parseProviderFromRawText(rawTexts[i], i + 1);
    if (provider) providers.push(provider);
  }

  return providers;
}

async function getAllProviders(page: Page): Promise<Provider[]> {
  let allProviders: Provider[] = [];

  // Get providers from current page
  const pageProviders = await extractProvidersFromPage(page);
  allProviders.push(...pageProviders);

  // Check for pagination and get all pages
  let pageNum = 2;
  while (pageNum <= 5) {
    // Max 5 pages to avoid infinite loops
    const nextLink = await page.$(`a[href*="page=${pageNum}"], .tqc-pagination a:has-text("${pageNum}")`);
    if (!nextLink) break;

    // Check if there's a "next" button or numbered page link
    const nextBtn = await page.$('a:has-text("››"), a[rel="next"]');
    const clickTarget = nextBtn || nextLink;

    try {
      await clickTarget.click();
      await delay(3000);

      const nextProviders = await extractProvidersFromPage(page);
      if (nextProviders.length === 0) break;

      allProviders.push(...nextProviders);
      pageNum++;
    } catch {
      break;
    }
  }

  return allProviders;
}

async function searchProcedure(
  page: Page,
  procedureId: string,
  zip: string
): Promise<CategoryResult> {
  const serviceCode = SERVICE_CODES[procedureId];
  const category =
    Object.entries(ANACARE_CATEGORIES).find(([, procs]) =>
      procs.includes(procedureId)
    )?.[0] || "Unknown";

  const result: CategoryResult = {
    category,
    procedureId,
    procedureName: PROCEDURE_NAMES[procedureId] || procedureId,
    zip,
    providers: [],
    packages: [],
    procedures: [],
    timestamp: new Date().toISOString(),
  };

  if (!serviceCode) return result;

  try {
    const coords = ZIP_COORDS[zip];
    const locParams = coords
      ? `&search_lat=${coords.lat}&search_lng=${coords.lng}`
      : `&zip=${zip}`;
    const url = `https://turquoise.health/care/search/?service=${serviceCode}&action=common-service&plan=specified-no-plan${locParams}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000);

    // Dismiss cookie banner
    const denyBtn = await page.$(
      '#CybotCookiebotDialogBodyButtonDecline, button:has-text("Deny")'
    );
    if (denyBtn) {
      await denyBtn.click().catch(() => {});
      await delay(500);
    }

    // Screenshot
    const screenshotName = `${procedureId}_${zip}.png`;
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, screenshotName),
      fullPage: true,
    });
    result.screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);

    // Extract total results count
    const bodyText = (await page.textContent("body")) || "";
    const totalMatch = bodyText.match(/(\d+)\s*results?\s*for/i);
    if (totalMatch) {
      console.log(`    ${totalMatch[1]} results found`);
    }

    // Get providers from page 1 only (faster; pagination adds marginal value)
    result.providers = await extractProvidersFromPage(page);
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}`);
  }

  return result;
}

async function extractPackagesFromDetail(page: Page): Promise<PackageRow[]> {
  const packages: PackageRow[] = [];

  // Click expand buttons to show package details
  const expandBtns = await page.$$(
    'button:has-text("procedure"), button:has-text("included"), button:has-text("package"), button:has-text("Show"), [class*="accordion"], [class*="expand"]'
  );
  for (const btn of expandBtns) {
    try {
      await btn.click();
      await delay(600);
    } catch {}
  }

  // Extract line items
  const items = await page.$$(
    '[class*="line-item"], [class*="package"] li, [class*="bundle"] li, [class*="breakdown"] tr, [class*="procedure-list"] li, [class*="included"] li'
  );

  for (const item of items) {
    const text = (await item.textContent())?.trim();
    if (!text || text.length < 3) continue;

    const cptMatch = text.match(/(\d{5})/);
    const priceMatch = text.match(/\$([\d,]+)/);

    packages.push({
      code: cptMatch ? cptMatch[1] : "",
      codeType: cptMatch ? "CPT" : "bundle",
      description: text.replace(/\s+/g, " ").trim(),
      cost: priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : undefined,
    });
  }

  return packages;
}

async function extractProceduresFromDetail(page: Page): Promise<string[]> {
  const procedures: string[] = [];
  const bodyText = (await page.textContent("body")) || "";

  // Look for CPT code references
  const cptMatches = bodyText.match(/CPT\s*:?\s*(\d{5})/gi);
  if (cptMatches) {
    procedures.push(...cptMatches.map((m) => m.trim()));
  }

  // Look for procedure descriptions in detail sections
  const descEls = await page.$$(
    '[class*="procedure"] li, [class*="service"] li, [class*="description"]'
  );
  for (const el of descEls) {
    const text = (await el.textContent())?.trim();
    if (text && text.length > 5 && text.length < 200) {
      procedures.push(text);
    }
  }

  return [...new Set(procedures)];
}

export async function crawlTurquoise(): Promise<CategoryResult[]> {
  ensureDirs();
  const results: CategoryResult[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Landing screenshot
    await page.goto("https://turquoise.health/patients", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await delay(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "landing.png"),
      fullPage: true,
    });

    // Crawl all procedures × ZIPs
    let count = 0;
    const total = Object.values(ANACARE_CATEGORIES).flat().length * TEST_ZIPS.length;

    for (const [category, procedureIds] of Object.entries(ANACARE_CATEGORIES)) {
      for (const procId of procedureIds) {
        for (const zip of TEST_ZIPS) {
          count++;
          console.log(`[${count}/${total}] ${procId} @ ${zip}`);

          const result = await searchProcedure(page, procId, zip);
          result.category = category;
          results.push(result);

          // Save raw JSON
          fs.writeFileSync(
            path.join(RAW_DIR, `${procId}_${zip}.json`),
            JSON.stringify(result, null, 2)
          );

          await delay(800);
        }
      }
    }

    await context.close();
  } catch (err) {
    console.error("Turquoise crawl fatal:", err);
  } finally {
    if (browser) await browser.close();
  }

  const withProviders = results.filter((r) => r.providers.length > 0);
  console.log(`\nDone: ${results.length} total, ${withProviders.length} with providers`);
  return results;
}

if (require.main === module) {
  crawlTurquoise().catch(console.error);
}
