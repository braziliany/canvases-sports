import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYangtzeEveningNewsResults } from "../src/adapters/results/yangtze-evening-news.js";
import { parseXinhuaDailyHuaweiResults } from "../src/adapters/results/xinhua-daily-huawei.js";
import { resolveCliDataDirectory } from "../src/core/cli-data-directory.js";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import { prepareProductionResultSync } from "../src/core/production-result-sync.js";
import { fetchSourceSnapshot } from "../src/core/source-fetch.js";
import { RESULT_SOURCES } from "../src/sources/result-sources.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialDataDirectory = resolve(projectRoot, "data");
const adapters = new Map([
  ["yangtze-evening-news-final-report-v1", parseYangtzeEveningNewsResults],
  ["xinhua-daily-huawei-final-report-v1", parseXinhuaDailyHuaweiResults]
]);

async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function readOptionalJson(path) {
  try { return await readJson(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

async function main() {
  const dataSelection = await resolveCliDataDirectory(process.argv.slice(2), officialDataDirectory);
  const unsupported = dataSelection.remainingArguments.filter((arg) => arg !== "--dry-run");
  if (unsupported.length) throw new Error(`Unsupported arguments: ${unsupported.join(", ")}`);
  const dryRun = dataSelection.remainingArguments.includes("--dry-run");
  const paths = {
    fixtures: resolve(dataSelection.dataDirectory, "fixtures.json"),
    standings: resolve(dataSelection.dataDirectory, "standings.json"),
    candidates: resolve(dataSelection.dataDirectory, "result-candidates.json"),
    baseline: resolve(dataSelection.dataDirectory, "sources/jiangsu-2026-08-22.json"),
    rankingReference: resolve(dataSelection.dataDirectory, "sources/results/2026-08-29-w19-official-standings-reference.json")
  };
  const [fixturesData, standingsData, candidatesData, source, rankingReference] = await Promise.all([
    readJson(paths.fixtures), readJson(paths.standings), readJson(paths.candidates), readJson(paths.baseline),
    readJson(paths.rankingReference)
  ]);
  const now = new Date();
  const snapshots = await Promise.all(RESULT_SOURCES.map(async (config) => {
    const path = resolve(dataSelection.dataDirectory, "sources/results", config.fileName);
    const previousSnapshot = await readOptionalJson(path);
    return { path, data: await fetchSourceSnapshot(config, { previousSnapshot, now }) };
  }));
  const observations = snapshots.flatMap(({ data }) => {
    const adapter = adapters.get(data.adapter);
    if (!adapter) throw new Error(`No adapter registered for ${data.adapter}`);
    return adapter(data);
  });
  const prepared = prepareProductionResultSync({
    source, rankingReference, fixturesData, candidatesData, observations, confirmedAt: now.toISOString()
  });

  console.log(`Fetched ${snapshots.length} trusted sources.`);
  console.log(`Parsed ${observations.length} observations.`);
  for (const decision of prepared.reconciliation.decisions) {
    console.log(`${decision.status}: ${decision.fixtureId} ${decision.score?.join(":") ?? "-"} (${decision.reason})`);
  }
  console.log(`Created ${prepared.discovery.discovered.length} candidates; confirmed ${prepared.settlements.length}.`);
  const entries = [
    ...snapshots,
    { path: paths.fixtures, data: prepared.fixturesData },
    { path: paths.standings, data: prepared.standingsData },
    { path: paths.candidates, data: prepared.candidatesData }
  ];
  const originals = new Map([
    [paths.fixtures, fixturesData], [paths.standings, standingsData], [paths.candidates, candidatesData]
  ]);
  for (const snapshot of snapshots) originals.set(snapshot.path, await readOptionalJson(snapshot.path));
  const changedEntries = entries.filter((entry) => !sameJson(originals.get(entry.path), entry.data));
  if (dryRun) {
    console.log(`Dry run complete: ${changedEntries.length} files would change. No files were written.`);
    return;
  }
  if (!changedEntries.length) {
    console.log("Production result sync is already current. No files were written.");
    return;
  }
  await commitJsonFilesAtomically(changedEntries);
  console.log(`Committed ${changedEntries.length} data files transactionally.`);
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
