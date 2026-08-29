import { readFile, writeFile } from "node:fs/promises";
import { normalizeFixtureStatuses } from "../src/core/fixture-state.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";

const nowArgument = process.argv.find((argument) => argument.startsWith("--now="));
const now = nowArgument ? nowArgument.slice("--now=".length) : new Date();
const fixturesUrl = new URL("../data/fixtures.json", import.meta.url);
const fixtures = JSON.parse(await readFile(fixturesUrl, "utf8"));
const normalized = normalizeFixtureStatuses(fixtures, { now });

validateFixtures(normalized);
await writeFile(fixturesUrl, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(`Normalized ${normalized.fixtures.length} fixtures at ${normalized.effectiveStatusAt}`);
