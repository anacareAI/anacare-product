import { type Page } from "playwright";
import { type Provider, type PackageRow } from "../types";

/**
 * Deep scraper for Turquoise Health results pages.
 * Attempts multiple extraction strategies for robustness.
 */

export async function scrapeProviderCards(page: Page): Promise<Provider[]> {
  const providers: Provider[] = [];

  // Strategy 1: Structured data (JSON-LD)
  const jsonLd = await page.$$eval('script[type="application/ld+json"]', (scripts) =>
    scripts.map((s) => {
      try {
        return JSON.parse(s.textContent || "");
      } catch {
        return null;
      }
    })
  );

  for (const data of jsonLd) {
    if (data?.["@type"] === "Hospital" || data?.["@type"] === "MedicalClinic") {
      providers.push({
        name: data.name,
        city: data.address?.addressLocality,
        state: data.address?.addressRegion,
      });
    }
  }

  if (providers.length > 0) return providers;

  // Strategy 2: DOM extraction
  const cards = await page.$$('[class*="result"], [class*="provider"], [class*="facility"], [class*="hospital"]');
  for (const card of cards) {
    const nameEl = await card.$("h2, h3, h4, [class*='name'], [class*='title']");
    const name = nameEl ? (await nameEl.textContent())?.trim() : null;
    if (!name || name.length < 3) continue;

    const text = (await card.textContent()) || "";
    const priceMatch = text.match(/\$[\d,]+/);
    const distMatch = text.match(/([\d.]+)\s*mi/);
    const cityStateMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})/);

    providers.push({
      name,
      estimatedOop: priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : undefined,
      distance: distMatch ? parseFloat(distMatch[1]) : undefined,
      city: cityStateMatch?.[1]?.trim(),
      state: cityStateMatch?.[2],
    });
  }

  // Strategy 3: Table rows
  if (providers.length === 0) {
    const rows = await page.$$("table tbody tr");
    for (const row of rows) {
      const cells = await row.$$("td");
      if (cells.length >= 2) {
        const name = (await cells[0].textContent())?.trim();
        if (name && name.length > 3) {
          const priceText = cells.length > 1 ? (await cells[1].textContent()) : "";
          const priceMatch = priceText?.match(/\$[\d,]+/);
          providers.push({
            name,
            estimatedOop: priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : undefined,
          });
        }
      }
    }
  }

  return providers;
}

export async function scrapePackages(page: Page): Promise<PackageRow[]> {
  const packages: PackageRow[] = [];

  // Click any "see procedures" or "view package" buttons
  const expandBtns = await page.$$(
    'button:has-text("procedure"), button:has-text("package"), button:has-text("included"), [class*="expand"], [class*="toggle"]'
  );

  for (const btn of expandBtns) {
    try {
      await btn.click();
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      // ignore
    }
  }

  // Extract package items
  const items = await page.$$(
    '[class*="package"] li, [class*="bundle"] li, [class*="procedure-list"] li, [class*="included"] li, [class*="breakdown"] tr'
  );

  for (const item of items) {
    const text = (await item.textContent())?.trim();
    if (!text || text.length < 3) continue;

    const cptMatch = text.match(/(\d{5})/);
    const priceMatch = text.match(/\$[\d,]+/);

    packages.push({
      code: cptMatch ? cptMatch[1] : "",
      codeType: cptMatch ? "CPT" : "bundle",
      description: text,
      cost: priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : undefined,
    });
  }

  return packages;
}

export async function scrapeProcedureList(page: Page): Promise<string[]> {
  const procedures: string[] = [];

  const selectors = [
    '[class*="procedure"] li',
    '[class*="service-item"]',
    '[class*="included-service"]',
    '[class*="bundle-item"]',
  ];

  for (const sel of selectors) {
    const els = await page.$$(sel);
    for (const el of els) {
      const text = (await el.textContent())?.trim();
      if (text && text.length > 3) procedures.push(text);
    }
    if (procedures.length > 0) break;
  }

  return procedures;
}

export async function scrapePayerFilters(page: Page): Promise<string[]> {
  const payers: string[] = [];

  // Look for insurance/payer filter dropdowns
  const filterEls = await page.$$(
    'select[class*="payer"], select[class*="insurance"], [class*="filter"] select option, [class*="payer"] option'
  );

  for (const el of filterEls) {
    const text = (await el.textContent())?.trim();
    if (text && text.length > 2 && !text.toLowerCase().includes("select")) {
      payers.push(text);
    }
  }

  return payers;
}
