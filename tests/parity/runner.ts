import * as fs from "fs";
import * as path from "path";
import { crawlTurquoise } from "./turquoise/crawler";
import { crawlAnaCare } from "./anacare/crawler";
import { runNormalization } from "./normalizer";
import { runComparison } from "./comparator";
import { type ParitySummary } from "./types";

const REPORTS_DIR = path.resolve(__dirname, "reports");

async function runFullParity(): Promise<ParitySummary> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  AnaCare vs Turquoise Parity Test Suite  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Step 1: Check if raw data exists, crawl if not
  const turqRaw = path.resolve(__dirname, "turquoise", "raw");
  const anaRaw = path.resolve(__dirname, "anacare", "raw");
  const turqFiles = fs.existsSync(turqRaw)
    ? fs.readdirSync(turqRaw).filter((f) => f.endsWith(".json"))
    : [];
  const anaFiles = fs.existsSync(anaRaw)
    ? fs.readdirSync(anaRaw).filter((f) => f.endsWith(".json"))
    : [];

  if (turqFiles.length < 66) {
    console.log("━━━ STEP 1: Crawling Turquoise Health ━━━");
    const results = await crawlTurquoise();
    console.log(
      `  → ${results.length} results, ${results.filter((r) => r.providers.length > 0).length} with providers\n`
    );
  } else {
    console.log("━━━ STEP 1: Turquoise data exists (skipping crawl) ━━━\n");
  }

  if (anaFiles.length < 66) {
    console.log("━━━ STEP 2: Crawling AnaCare ━━━");
    const results = await crawlAnaCare();
    console.log(
      `  → ${results.length} results, ${results.filter((r) => r.providers.length > 0).length} with providers\n`
    );
  } else {
    console.log("━━━ STEP 2: AnaCare data exists (skipping crawl) ━━━\n");
  }

  // Step 3: Normalize
  console.log("━━━ STEP 3: Normalizing Data ━━━");
  runNormalization();
  console.log("  → Complete\n");

  // Step 4: Compare
  console.log("━━━ STEP 4: Comparing Results ━━━");
  const summary = runComparison();

  // Step 5: Summary
  console.log("\n━━━ FINAL SUMMARY ━━━");
  console.log(`  Total Tests:        ${summary.totalTests}`);
  console.log(
    `  PASS: ${summary.passed} | FAIL: ${summary.failed} | PARTIAL: ${summary.partial} | BLOCKED: ${summary.blocked}`
  );
  console.log(`  Provider Parity:    ${summary.overallProviderParity}%`);
  console.log(`  Package Parity:     ${summary.overallPackageParity}%`);
  console.log(`  Network Parity:     ${summary.overallNetworkParity}%`);
  console.log(`  Price Ballpark:     ${summary.overallPricingBallparkParity}%`);
  console.log(`  Ranking Alignment:  ${summary.overallRankingAlignment}%`);
  console.log(`\n  Reports: ${REPORTS_DIR}/`);

  // Save summary JSON
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, "parity_summary.json"),
    JSON.stringify(summary, null, 2)
  );

  return summary;
}

runFullParity()
  .then((summary) => {
    const pass =
      summary.overallProviderParity >= 95 &&
      summary.overallPackageParity >= 90 &&
      summary.overallPricingBallparkParity >= 80;
    console.log(
      `\nResult: ${pass ? "✓ TARGETS MET" : "✗ BELOW TARGET"}`
    );
    process.exit(pass ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(2);
  });
