import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { resolveCliDataDirectory } from "../src/core/cli-data-directory.js";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import {
  appendResultCandidate,
  formatCandidatePreview,
  listEligibleResultFixtures,
  normalizeResultSource,
  normalizeResultSourceUrl,
  parseResultScore,
  pendingCandidatesForFixture,
  persistCandidateIfApproved,
  selectResultFixture
} from "../src/core/result-candidate-entry.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialDataDirectory = resolve(projectRoot, "data");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function askValid(prompt, message, parse) {
  while (true) {
    const input = await prompt.question(message);
    try {
      return parse(input);
    } catch (error) {
      console.error(error.message);
    }
  }
}

function printExistingCandidates(candidates) {
  console.log("\n该比赛已有未审核 Candidate：");
  for (const candidate of candidates) {
    console.log([
      `ID: ${candidate.id}`,
      `比分: ${candidate.homeTeam} ${candidate.homeScore}:${candidate.awayScore} ${candidate.awayTeam}`,
      `来源: ${candidate.source}`,
      `observedAt: ${candidate.observedAt}`
    ].join("\n"));
    console.log("");
  }
}

async function main() {
  const dataSelection = await resolveCliDataDirectory(
    process.argv.slice(2),
    officialDataDirectory
  );
  if (dataSelection.remainingArguments.length > 0) {
    throw new Error(`Unsupported arguments: ${dataSelection.remainingArguments.join(", ")}`);
  }
  const paths = {
    fixtures: resolve(dataSelection.dataDirectory, "fixtures.json"),
    candidates: resolve(dataSelection.dataDirectory, "result-candidates.json")
  };
  if (dataSelection.isolated) {
    console.log(`Isolation data directory: ${dataSelection.dataDirectory}`);
  }
  const [fixturesData, candidatesData] = await Promise.all([
    readJson(paths.fixtures),
    readJson(paths.candidates)
  ]);
  validateFixtures(fixturesData);
  validateResultCandidates(candidatesData);
  const eligibleFixtures = listEligibleResultFixtures(fixturesData);
  if (eligibleFixtures.length === 0) throw new Error("No fixtures are eligible for result entry.");

  console.log("可录入比赛：");
  eligibleFixtures.forEach((fixture, index) => {
    console.log(`${index + 1}. ${fixture.date} ${fixture.time}  ${fixture.homeTeam} VS ${fixture.awayTeam}`);
    console.log(`   ID: ${fixture.id}`);
  });

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const fixture = await askValid(
      prompt,
      "\n选择序号或 fixture ID： ",
      (input) => selectResultFixture(input, eligibleFixtures)
    );
    const existing = pendingCandidatesForFixture(candidatesData, fixture.id);
    if (existing.length > 0) {
      printExistingCandidates(existing);
      const continueAnswer = await prompt.question("输入 MORE 以继续新增另一条 Candidate；其他输入取消： ");
      if (continueAnswer.trim() !== "MORE") {
        console.log("Cancelled. No data files were changed.");
        return;
      }
    }

    console.log(`\n比赛：\n${fixture.homeTeam} VS ${fixture.awayTeam}`);
    const homeScore = await askValid(prompt, "\n主队比分： ", (input) =>
      parseResultScore(input, "homeScore"));
    const awayScore = await askValid(prompt, "客队比分： ", (input) =>
      parseResultScore(input, "awayScore"));
    const source = await askValid(prompt, "来源： ", normalizeResultSource);
    const sourceUrl = await askValid(prompt, "来源 URL（可为空）： ", normalizeResultSourceUrl);
    const observedAt = new Date().toISOString();
    const prepared = appendResultCandidate({
      fixturesData,
      candidatesData,
      fixtureId: fixture.id,
      homeScore,
      awayScore,
      source,
      sourceUrl,
      observedAt
    });

    console.log(`\n${formatCandidatePreview(prepared.candidate, fixture)}`);
    const answer = await prompt.question("\n输入 ADD 以写入 Candidate；其他输入取消： ");
    const added = await persistCandidateIfApproved({
      answer,
      candidatesData: prepared.candidatesData,
      persist: (data) => commitJsonFilesAtomically([
        { path: paths.candidates, data }
      ])
    });
    if (!added) {
      console.log("Cancelled. No data files were changed.");
      return;
    }
    console.log(`Added ResultCandidate ${prepared.candidate.id}.`);
    console.log(`Next step after source review: npm run results:confirm -- ${prepared.candidate.id}`);
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
