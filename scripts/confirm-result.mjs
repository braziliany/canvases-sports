import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { resolveCliDataDirectory } from "../src/core/cli-data-directory.js";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";
import {
  executePreparedSettlement,
  prepareResultSettlement
} from "../src/core/result-settlement-pipeline.js";
import { formatResultCandidateReview } from "../src/core/result-settlement.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialDataDirectory = resolve(projectRoot, "data");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function runTests() {
  const testDirectory = resolve(projectRoot, "tests");
  const testFiles = (await readdir(testDirectory))
    .filter((name) => name.endsWith(".test.js"))
    .sort();
  if (testFiles.length === 0) throw new Error("No test files found");

  for (const testFile of testFiles) {
    await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [resolve(testDirectory, testFile)], {
        cwd: projectRoot,
        stdio: "inherit"
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) resolvePromise();
        else reject(new Error(
          `${testFile} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`
        ));
      });
    });
  }
}

function printUsage(candidates) {
  console.error("Usage: npm run results:confirm -- <candidateId>");
  const pending = candidates.candidates.filter((candidate) => candidate.reviewStatus === "candidate");
  if (pending.length === 0) console.error("No pending result candidates.");
  else {
    console.error("Pending candidates:");
    for (const candidate of pending) {
      console.error(`- ${candidate.id}: ${candidate.homeTeam} ${candidate.homeScore}:${candidate.awayScore} ${candidate.awayTeam}`);
    }
  }
}

async function main() {
  const dataSelection = await resolveCliDataDirectory(
    process.argv.slice(2),
    officialDataDirectory
  );
  const paths = {
    source: resolve(dataSelection.dataDirectory, "sources/jiangsu-2026-08-15.json"),
    fixtures: resolve(dataSelection.dataDirectory, "fixtures.json"),
    standings: resolve(dataSelection.dataDirectory, "standings.json"),
    candidates: resolve(dataSelection.dataDirectory, "result-candidates.json")
  };
  if (dataSelection.isolated) {
    console.log(`Isolation data directory: ${dataSelection.dataDirectory}`);
  }
  const [source, fixturesData, candidatesData] = await Promise.all([
    readJson(paths.source),
    readJson(paths.fixtures),
    readJson(paths.candidates)
  ]);
  validateFixtures(fixturesData);
  validateResultCandidates(candidatesData);

  const candidateId = dataSelection.remainingArguments.find((argument) => !argument.startsWith("--"));
  const unsupported = dataSelection.remainingArguments.filter((argument) => argument !== candidateId);
  if (unsupported.length > 0) throw new Error(`Unsupported arguments: ${unsupported.join(", ")}`);
  if (!candidateId) {
    printUsage(candidatesData);
    process.exitCode = 1;
    return;
  }
  const candidate = candidatesData.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`Unknown result candidate: ${candidateId}`);
  const fixture = fixturesData.fixtures.find((item) => item.id === candidate.fixtureId);
  if (!fixture) throw new Error(`Candidate references unknown fixture: ${candidate.fixtureId}`);

  console.log(formatResultCandidateReview(candidate, fixture));
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question("\n输入 CONFIRM 以确认写入；其他输入将取消： ");
  prompt.close();
  if (answer.trim() !== "CONFIRM") {
    console.log("Cancelled. Formal data was not changed.");
    return;
  }

  const confirmedAt = new Date().toISOString();
  const prepared = await executePreparedSettlement({
    prepare: () => prepareResultSettlement({
      source,
      fixturesData,
      candidatesData,
      candidateId,
      confirmedAt
    }),
    verify: async () => {
      console.log("In-memory fixtures, candidates, and standings validation passed.");
      console.log("Running the complete test suite before writing formal data...");
      await runTests();
    },
    commit: async (result) => {
      if (!result.outcome.changed) return;
      await commitJsonFilesAtomically([
        { path: paths.fixtures, data: result.fixturesData },
        { path: paths.standings, data: result.standingsData },
        { path: paths.candidates, data: result.candidatesData }
      ]);
    }
  });

  console.log(prepared.outcome.idempotent
    ? `Result ${candidateId} was already settled with the same score; verification completed.`
    : `Confirmed ${candidateId}; fixtures and standings were committed together.`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
