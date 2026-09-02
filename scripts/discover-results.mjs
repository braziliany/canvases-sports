import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseYangtzeEveningNewsResults } from "../src/adapters/results/yangtze-evening-news.js";
import { resolveCliDataDirectory } from "../src/core/cli-data-directory.js";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import { persistCandidateIfApproved } from "../src/core/result-candidate-entry.js";
import { discoverResultCandidates } from "../src/core/result-discovery.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialDataDirectory = resolve(projectRoot, "data");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function printDiscovery(snapshot, observations, result) {
  console.log(`Source: ${snapshot.source.name}`);
  console.log(`URL: ${snapshot.source.url}`);
  console.log(`Snapshot retrieved: ${snapshot.source.retrievedAt}`);
  console.log(`Parsed ${observations.length} observations.`);
  console.log(`Discovered ${result.discovered.length} new result candidates.`);

  result.discovered.forEach(({ candidate, fixture }, index) => {
    console.log(`\n${index + 1}. ${candidate.homeTeam} ${candidate.homeScore} : ${candidate.awayScore} ${candidate.awayTeam}`);
    console.log(`   Fixture: ${fixture.id} (${fixture.date}, round ${fixture.round})`);
    console.log(`   Candidate: ${candidate.id}`);
    console.log(`   Source: ${candidate.source}`);
    console.log(`   URL: ${candidate.sourceUrl}`);
  });
  for (const duplicate of result.duplicates) {
    console.log(`\nDuplicate skipped: ${duplicate.fixtureId} → ${duplicate.candidateId}`);
  }
  for (const failure of result.failures) {
    console.error(`\n${failure.errorName}: ${failure.message}`);
  }
}

async function main() {
  const dataSelection = await resolveCliDataDirectory(
    process.argv.slice(2),
    officialDataDirectory
  );
  const paths = {
    snapshot: resolve(dataSelection.dataDirectory, "sources/results/2026-08-29-w19-yangzi-evening-news.json"),
    fixtures: resolve(dataSelection.dataDirectory, "fixtures.json"),
    candidates: resolve(dataSelection.dataDirectory, "result-candidates.json")
  };
  const supportedArguments = new Set(["--dry-run"]);
  const argumentsList = dataSelection.remainingArguments;
  const unsupported = argumentsList.filter((argument) => !supportedArguments.has(argument));
  if (unsupported.length) throw new Error(`Unsupported arguments: ${unsupported.join(", ")}`);
  const dryRun = argumentsList.includes("--dry-run");

  if (dataSelection.isolated) {
    console.log(`Isolation data directory: ${dataSelection.dataDirectory}`);
  }

  const [snapshot, fixturesData, candidatesData] = await Promise.all([
    readJson(paths.snapshot),
    readJson(paths.fixtures),
    readJson(paths.candidates)
  ]);
  validateFixtures(fixturesData);
  validateResultCandidates(candidatesData);
  const observations = parseYangtzeEveningNewsResults(snapshot);
  const result = discoverResultCandidates({ observations, fixturesData, candidatesData });
  printDiscovery(snapshot, observations, result);

  if (result.failures.length) {
    throw new Error("Discovery stopped because one or more observations could not be matched safely");
  }
  if (dryRun) {
    console.log("\nDry run complete. No data files were changed.");
    return;
  }
  if (result.discovered.length === 0) {
    console.log("\nNo new candidates to add. No data files were changed.");
    return;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question("\n输入 ADD 以写入发现的 Candidate；其他输入取消： ");
    const added = await persistCandidateIfApproved({
      answer,
      candidatesData: result.candidatesData,
      persist: (data) => commitJsonFilesAtomically([{ path: paths.candidates, data }])
    });
    if (!added) {
      console.log("Cancelled. No data files were changed.");
      return;
    }
    console.log(`Added ${result.discovered.length} discovered ResultCandidate records.`);
    console.log("Next step: review each candidate with npm run results:confirm -- <candidateId>");
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
