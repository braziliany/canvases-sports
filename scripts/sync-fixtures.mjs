import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCliDataDirectory } from "../src/core/cli-data-directory.js";
import { normalizeFixtureStatuses } from "../src/core/fixture-state.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialDataDirectory = resolve(projectRoot, "data");

function presentationSnapshot(data) {
  const snapshot = structuredClone(data);
  delete snapshot.effectiveStatusAt;
  return snapshot;
}

function samePresentation(left, right) {
  return JSON.stringify(presentationSnapshot(left)) === JSON.stringify(presentationSnapshot(right));
}

async function main() {
  const dataSelection = await resolveCliDataDirectory(process.argv.slice(2), officialDataDirectory);
  const dryRun = dataSelection.remainingArguments.includes("--dry-run");
  const nowArguments = dataSelection.remainingArguments.filter((argument) => argument.startsWith("--now="));
  const unsupported = dataSelection.remainingArguments.filter((argument) =>
    argument !== "--dry-run" && !argument.startsWith("--now=")
  );
  if (unsupported.length) throw new Error(`Unsupported arguments: ${unsupported.join(", ")}`);
  if (nowArguments.length > 1) throw new Error("--now may only be provided once");

  const now = nowArguments.length ? nowArguments[0].slice("--now=".length) : new Date();
  const fixturesPath = resolve(dataSelection.dataDirectory, "fixtures.json");
  const fixturesData = validateFixtures(JSON.parse(await readFile(fixturesPath, "utf8")));
  const normalized = validateFixtures(normalizeFixtureStatuses(fixturesData, { now }));
  const changed = !samePresentation(fixturesData, normalized);

  console.log(`Fixture presentation at ${normalized.effectiveStatusAt}: round ${normalized.displayRound ?? "none"} (${normalized.displaySelectionReason}).`);
  if (!changed) {
    console.log("Fixture presentation is already current. No files were written.");
    return;
  }
  if (dryRun) {
    console.log("Would change: fixtures.json");
    console.log("Dry run complete: 1 file would change. No files were written.");
    return;
  }

  await commitJsonFilesAtomically([{ path: fixturesPath, data: normalized }]);
  console.log("Committed fixtures.json transactionally.");
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
