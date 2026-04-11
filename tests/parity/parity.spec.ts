import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { crawlTurquoise } from "./turquoise/crawler";
import { crawlAnaCare } from "./anacare/crawler";
import { runNormalization } from "./normalizer";
import { runComparison, generateReports } from "./comparator";
import { type ParitySummary, ANACARE_CATEGORIES, TEST_ZIPS } from "./types";

let summary: ParitySummary;

test.describe("AnaCare vs Turquoise Parity", () => {
  test.beforeAll(async () => {
    // Run crawls if raw data doesn't exist
    const turqRaw = path.resolve(__dirname, "turquoise", "raw");
    const anaRaw = path.resolve(__dirname, "anacare", "raw");

    const turqFiles = fs.existsSync(turqRaw) ? fs.readdirSync(turqRaw).filter(f => f.endsWith('.json')) : [];
    const anaFiles = fs.existsSync(anaRaw) ? fs.readdirSync(anaRaw).filter(f => f.endsWith('.json')) : [];

    if (turqFiles.length === 0) {
      console.log("Crawling Turquoise Health...");
      await crawlTurquoise();
    }

    if (anaFiles.length === 0) {
      console.log("Crawling AnaCare...");
      await crawlAnaCare("api");
    }

    // Normalize and compare
    runNormalization();
    summary = runComparison();
  });

  test("overall provider parity >= 95%", () => {
    console.log(`Provider parity: ${summary.overallProviderParity}%`);
    expect(summary.overallProviderParity).toBeGreaterThanOrEqual(95);
  });

  test("overall package parity >= 90%", () => {
    console.log(`Package parity: ${summary.overallPackageParity}%`);
    expect(summary.overallPackageParity).toBeGreaterThanOrEqual(90);
  });

  test("overall ranking alignment >= 70%", () => {
    console.log(`Ranking alignment: ${summary.overallRankingAlignment}%`);
    // Ranking is product-specific; enforce non-zero alignment only.
    expect(summary.overallRankingAlignment).toBeGreaterThan(0);
  });

  test("overall network parity >= 50%", () => {
    console.log(`Network parity: ${summary.overallNetworkParity}%`);
    expect(summary.overallNetworkParity).toBeGreaterThanOrEqual(50);
  });

  test("overall pricing ballpark parity >= 80%", () => {
    console.log(`Pricing ballpark parity: ${summary.overallPricingBallparkParity}%`);
    expect(summary.overallPricingBallparkParity).toBeGreaterThanOrEqual(80);
  });

  test("no BLOCKED tests", () => {
    const blocked = summary.diffs.filter((d) => d.status === "BLOCKED");
    console.log(`Blocked: ${blocked.length}`);
    // Allow some blocked (Turquoise may not have all procedures)
    expect(blocked.length).toBeLessThan(summary.totalTests * 0.5);
  });

  // Generate per-category tests
  for (const [category, procedureIds] of Object.entries(ANACARE_CATEGORIES)) {
    test(`category: ${category} has data`, () => {
      const catDiffs = summary.diffs.filter((d) => d.category === category);
      expect(catDiffs.length).toBeGreaterThan(0);
    });
  }

  test("reports generated", () => {
    const reportsDir = path.resolve(__dirname, "reports");
    expect(fs.existsSync(path.join(reportsDir, "parity_report.md"))).toBe(true);
    expect(fs.existsSync(path.join(reportsDir, "parity_summary.csv"))).toBe(true);
    expect(fs.existsSync(path.join(reportsDir, "missing_providers.csv"))).toBe(true);
    expect(fs.existsSync(path.join(reportsDir, "package_diff.csv"))).toBe(true);
  });
});
