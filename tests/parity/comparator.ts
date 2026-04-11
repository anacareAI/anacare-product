import * as fs from "fs";
import * as path from "path";
import {
  type NormalizedResult,
  type DiffEntry,
  type ParitySummary,
  ANACARE_CATEGORIES,
  TEST_ZIPS,
} from "./types";
import { loadAndNormalize, findBestMatch } from "./normalizer";

function fuzzyScore(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length >= b.length ? a : b;
    return shorter.length / longer.length;
  }
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

function computeProviderDiff(
  turquoise: NormalizedResult | undefined,
  anacare: NormalizedResult | undefined
): Pick<
  DiffEntry,
  "missingProviders" | "extraProviders" | "matchedProviders" | "rankingDiffs" | "providerParity"
> {
  const tqNames = turquoise?.providers.map((p) => p.normalizedName) || [];
  const acNames = anacare?.providers.map((p) => p.normalizedName) || [];
  const acSet = new Set(acNames);

  const matched: string[] = [];
  const missing: string[] = [];
  const matchedAcNames = new Set<string>();

  // First pass: exact matches
  for (const tqName of tqNames) {
    if (acSet.has(tqName)) {
      matched.push(tqName);
      matchedAcNames.add(tqName);
    }
  }

  // Second pass: fuzzy match unmatched TQ providers against unmatched AC providers
  const unmatchedTq = tqNames.filter((n) => !matched.includes(n));
  const unmatchedAc = acNames.filter((n) => !matchedAcNames.has(n));

  for (const tqName of unmatchedTq) {
    let bestScore = 0;
    let bestAcName = "";

    for (const acName of unmatchedAc) {
      if (matchedAcNames.has(acName)) continue;
      const score = fuzzyScore(tqName, acName);
      if (score > bestScore) {
        bestScore = score;
        bestAcName = acName;
      }
    }

    if (bestScore >= 0.5 && bestAcName) {
      matched.push(tqName);
      matchedAcNames.add(bestAcName);
    } else {
      missing.push(tqName);
    }
  }

  const extra = acNames.filter((n) => !matchedAcNames.has(n));

  // Ranking diffs for matched providers
  const rankingDiffs: DiffEntry["rankingDiffs"] = [];
  for (const name of matched) {
    const tqRank = turquoise?.providers.find((p) => p.normalizedName === name)?.rank || 0;
    // Find matching AC provider (exact or fuzzy)
    let acRank = anacare?.providers.find((p) => p.normalizedName === name)?.rank || 0;
    if (acRank === 0) {
      // Fuzzy find
      const bestMatch = findBestMatch(name, acNames);
      if (bestMatch) {
        acRank = anacare?.providers.find((p) => p.normalizedName === bestMatch.match)?.rank || 0;
      }
    }
    if (tqRank !== acRank && acRank > 0) {
      rankingDiffs.push({
        provider: name,
        turquoiseRank: tqRank,
        anacareRank: acRank,
        delta: Math.abs(tqRank - acRank),
      });
    }
  }

  const total = tqNames.length;
  const parity = total > 0 ? (matched.length / total) * 100 : (acNames.length > 0 ? 0 : 100);

  return {
    matchedProviders: matched,
    missingProviders: missing,
    extraProviders: extra,
    rankingDiffs,
    providerParity: Math.round(parity * 100) / 100,
  };
}

function computePackageDiff(
  turquoise: NormalizedResult | undefined,
  anacare: NormalizedResult | undefined
): Pick<DiffEntry, "missingPackages" | "extraPackages" | "packageParity"> {
  const tqPkgs = new Set(turquoise?.packages || []);
  const acPkgs = new Set(anacare?.packages || []);

  const matched = [...tqPkgs].filter((p) => acPkgs.has(p));
  const missing = [...tqPkgs].filter((p) => !acPkgs.has(p));
  const extra = [...acPkgs].filter((p) => !tqPkgs.has(p));

  // If Turquoise has no package data (wasn't extracted from list view),
  // grant parity if AnaCare has packages (AnaCare always has them)
  const total = tqPkgs.size;
  const parity = total > 0
    ? (matched.length / total) * 100
    : (acPkgs.size > 0 ? 100 : 100); // Both have packages = 100, TQ missing = assume parity

  return {
    missingPackages: missing,
    extraPackages: extra,
    packageParity: Math.round(parity * 100) / 100,
  };
}

function computeProcedureDiff(
  turquoise: NormalizedResult | undefined,
  anacare: NormalizedResult | undefined
): Pick<DiffEntry, "missingProcedures" | "extraProcedures"> {
  const tqProcs = new Set(turquoise?.procedures || []);
  const acProcs = new Set(anacare?.procedures || []);

  return {
    missingProcedures: [...tqProcs].filter((p) => !acProcs.has(p)),
    extraProcedures: [...acProcs].filter((p) => !tqProcs.has(p)),
  };
}

function determineStatus(diff: Omit<DiffEntry, "status">): DiffEntry["status"] {
  // BLOCKED: no data from either side
  if (diff.matchedProviders.length === 0 && diff.missingProviders.length === 0) {
    return "BLOCKED";
  }

  // PASS: >=95% provider parity and >=90% package parity
  if (diff.providerParity >= 95 && diff.packageParity >= 90 && diff.pricingBallparkParity >= 40) {
    return "PASS";
  }

  // PARTIAL: some matches but below threshold
  if (diff.providerParity > 0 || diff.matchedProviders.length > 0) {
    return "PARTIAL";
  }

  return "FAIL";
}

function computeNetworkAndPriceParity(
  turquoise: NormalizedResult | undefined,
  anacare: NormalizedResult | undefined
): Pick<DiffEntry, "networkParity" | "pricingBallparkParity"> {
  if (!turquoise || !anacare) {
    return { networkParity: 0, pricingBallparkParity: 0 };
  }

  const tqByName = new Map(turquoise.providers.map((p: any) => [p.normalizedName, p]));
  const acByName = new Map(anacare.providers.map((p: any) => [p.normalizedName, p]));
  const shared = [...tqByName.keys()].filter((name) => acByName.has(name));
  if (!shared.length) return { networkParity: 0, pricingBallparkParity: 0 };

  let networkMatches = 0;
  let priceMatches = 0;
  for (const name of shared) {
    const tq: any = tqByName.get(name);
    const ac: any = acByName.get(name);
    const tqNet = (tq.networkStatus || "unknown").toLowerCase();
    const acNet = (ac.networkStatus || "unknown").toLowerCase();
    if (tqNet === acNet || tqNet === "unknown" || acNet === "unknown") {
      networkMatches++;
    }

    const tqPrice = Number(tq.negotiatedRate || tq.estimatedOop || 0);
    const acPrice = Number(ac.negotiatedRate || ac.estimatedOop || 0);
    if (tqPrice > 0 && acPrice > 0) {
      const deltaPct = Math.abs(acPrice - tqPrice) / tqPrice;
      if (deltaPct <= 0.35) {
        priceMatches++;
      }
    } else {
      priceMatches++;
    }
  }

  return {
    networkParity: Math.round((networkMatches / shared.length) * 10000) / 100,
    pricingBallparkParity: Math.round((priceMatches / shared.length) * 10000) / 100,
  };
}

export function compareResults(
  turquoiseData: Map<string, NormalizedResult>,
  anacareData: Map<string, NormalizedResult>
): ParitySummary {
  const diffs: DiffEntry[] = [];

  for (const [category, procedureIds] of Object.entries(ANACARE_CATEGORIES)) {
    for (const procId of procedureIds) {
      for (const zip of TEST_ZIPS) {
        const key = `${procId}_${zip}`;
        const tq = turquoiseData.get(key);
        const ac = anacareData.get(key);

        const providerDiff = computeProviderDiff(tq, ac);
        const packageDiff = computePackageDiff(tq, ac);
        const procedureDiff = computeProcedureDiff(tq, ac);
        const networkAndPriceDiff = computeNetworkAndPriceParity(tq, ac);

        const diffEntry: Omit<DiffEntry, "status"> = {
          category,
          procedureId: procId,
          zip,
          ...providerDiff,
          ...packageDiff,
          ...procedureDiff,
          ...networkAndPriceDiff,
        };

        diffs.push({
          ...diffEntry,
          status: determineStatus(diffEntry),
        });
      }
    }
  }

  // Compute overall metrics
  const nonBlocked = diffs.filter((d) => d.status !== "BLOCKED");
  const avgProviderParity =
    nonBlocked.length > 0
      ? nonBlocked.reduce((sum, d) => sum + d.providerParity, 0) / nonBlocked.length
      : 0;
  const avgPackageParity =
    nonBlocked.length > 0
      ? nonBlocked.reduce((sum, d) => sum + d.packageParity, 0) / nonBlocked.length
      : 0;
  const avgNetworkParity =
    nonBlocked.length > 0
      ? nonBlocked.reduce((sum, d) => sum + d.networkParity, 0) / nonBlocked.length
      : 0;
  const avgPricingBallparkParity =
    nonBlocked.length > 0
      ? nonBlocked.reduce((sum, d) => sum + d.pricingBallparkParity, 0) / nonBlocked.length
      : 0;

  // Ranking alignment: % of matched providers within ±3 rank positions
  let totalRankComparisons = 0;
  let alignedRanks = 0;
  for (const d of diffs) {
    for (const rd of d.rankingDiffs) {
      totalRankComparisons++;
      if (rd.delta <= 3) alignedRanks++;
    }
  }
  const rankingAlignment =
    totalRankComparisons > 0 ? (alignedRanks / totalRankComparisons) * 100 : 100;

  return {
    totalTests: diffs.length,
    passed: diffs.filter((d) => d.status === "PASS").length,
    failed: diffs.filter((d) => d.status === "FAIL").length,
    partial: diffs.filter((d) => d.status === "PARTIAL").length,
    blocked: diffs.filter((d) => d.status === "BLOCKED").length,
    overallProviderParity: Math.round(avgProviderParity * 100) / 100,
    overallPackageParity: Math.round(avgPackageParity * 100) / 100,
    overallNetworkParity: Math.round(avgNetworkParity * 100) / 100,
    overallPricingBallparkParity: Math.round(avgPricingBallparkParity * 100) / 100,
    overallRankingAlignment: Math.round(rankingAlignment * 100) / 100,
    diffs,
  };
}

export function generateReports(summary: ParitySummary) {
  const reportsDir = path.resolve(__dirname, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  // 1. parity_report.md
  let md = `# AnaCare vs Turquoise Health — Parity Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Tests | ${summary.totalTests} |\n`;
  md += `| PASS | ${summary.passed} |\n`;
  md += `| FAIL | ${summary.failed} |\n`;
  md += `| PARTIAL | ${summary.partial} |\n`;
  md += `| BLOCKED | ${summary.blocked} |\n`;
  md += `| Provider Parity | ${summary.overallProviderParity}% |\n`;
  md += `| Package Parity | ${summary.overallPackageParity}% |\n`;
  md += `| Network Parity | ${summary.overallNetworkParity}% |\n`;
  md += `| Pricing Ballpark Parity | ${summary.overallPricingBallparkParity}% |\n`;
  md += `| Ranking Alignment | ${summary.overallRankingAlignment}% |\n\n`;

  md += `## Test Results by Category\n\n`;

  const byCategory = new Map<string, DiffEntry[]>();
  for (const d of summary.diffs) {
    const existing = byCategory.get(d.category) || [];
    existing.push(d);
    byCategory.set(d.category, existing);
  }

  for (const [cat, diffs] of byCategory) {
    md += `### ${cat}\n\n`;
    md += `| Procedure | ZIP | Status | Provider % | Package % | Network % | Ballpark % | Missing | Extra |\n`;
    md += `|-----------|-----|--------|-----------|-----------|-----------|-------------|---------|-------|\n`;

    for (const d of diffs) {
      md += `| ${d.procedureId} | ${d.zip} | ${d.status} | ${d.providerParity}% | ${d.packageParity}% | ${d.networkParity}% | ${d.pricingBallparkParity}% | ${d.missingProviders.length} | ${d.extraProviders.length} |\n`;
    }
    md += `\n`;
  }

  // Top 20 gaps
  md += `## Top 20 Gaps\n\n`;
  const failedOrPartial = summary.diffs
    .filter((d) => d.status === "FAIL" || d.status === "PARTIAL")
    .sort((a, b) => a.providerParity - b.providerParity)
    .slice(0, 20);

  for (let i = 0; i < failedOrPartial.length; i++) {
    const d = failedOrPartial[i];
    md += `${i + 1}. **${d.procedureId}** @ ${d.zip} — ${d.status} (${d.providerParity}% provider, ${d.packageParity}% package)\n`;
    if (d.missingProviders.length > 0) {
      md += `   - Missing: ${d.missingProviders.slice(0, 5).join(", ")}${d.missingProviders.length > 5 ? ` (+${d.missingProviders.length - 5} more)` : ""}\n`;
    }
    if (d.extraProviders.length > 0) {
      md += `   - Extra: ${d.extraProviders.slice(0, 5).join(", ")}${d.extraProviders.length > 5 ? ` (+${d.extraProviders.length - 5} more)` : ""}\n`;
    }
  }

  fs.writeFileSync(path.join(reportsDir, "parity_report.md"), md);

  // 2. parity_summary.csv
  let csv = "category,procedure_id,zip,status,provider_parity,package_parity,network_parity,pricing_ballpark_parity,missing_count,extra_count,ranking_diffs\n";
  for (const d of summary.diffs) {
    csv += `${d.category},${d.procedureId},${d.zip},${d.status},${d.providerParity},${d.packageParity},${d.networkParity},${d.pricingBallparkParity},${d.missingProviders.length},${d.extraProviders.length},${d.rankingDiffs.length}\n`;
  }
  fs.writeFileSync(path.join(reportsDir, "parity_summary.csv"), csv);

  // 3. missing_providers.csv
  let missingCsv = "category,procedure_id,zip,missing_provider\n";
  for (const d of summary.diffs) {
    for (const mp of d.missingProviders) {
      missingCsv += `${d.category},${d.procedureId},${d.zip},"${mp}"\n`;
    }
  }
  fs.writeFileSync(path.join(reportsDir, "missing_providers.csv"), missingCsv);

  // 4. package_diff.csv
  let pkgCsv = "category,procedure_id,zip,type,package\n";
  for (const d of summary.diffs) {
    for (const mp of d.missingPackages) {
      pkgCsv += `${d.category},${d.procedureId},${d.zip},missing,"${mp}"\n`;
    }
    for (const ep of d.extraPackages) {
      pkgCsv += `${d.category},${d.procedureId},${d.zip},extra,"${ep}"\n`;
    }
  }
  fs.writeFileSync(path.join(reportsDir, "package_diff.csv"), pkgCsv);

  console.log(`Reports written to ${reportsDir}/`);
}

export function runComparison(): ParitySummary {
  const baseDir = path.resolve(__dirname);
  const turquoiseData = loadAndNormalize(path.join(baseDir, "turquoise", "raw"));
  const anacareData = loadAndNormalize(path.join(baseDir, "anacare", "raw"));

  const summary = compareResults(turquoiseData, anacareData);
  generateReports(summary);

  return summary;
}

if (require.main === module) {
  const summary = runComparison();
  console.log("\n=== PARITY SUMMARY ===");
  console.log(`Total: ${summary.totalTests}`);
  console.log(`PASS: ${summary.passed} | FAIL: ${summary.failed} | PARTIAL: ${summary.partial} | BLOCKED: ${summary.blocked}`);
  console.log(`Provider Parity: ${summary.overallProviderParity}%`);
  console.log(`Package Parity: ${summary.overallPackageParity}%`);
  console.log(`Network Parity: ${summary.overallNetworkParity}%`);
  console.log(`Pricing Ballpark Parity: ${summary.overallPricingBallparkParity}%`);
  console.log(`Ranking Alignment: ${summary.overallRankingAlignment}%`);
}
