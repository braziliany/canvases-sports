import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialFixturesPath = resolve(projectRoot, "data/fixtures.json");

function runSync(dataDirectory, ...argumentsList) {
  return spawnSync(process.execPath, [
    "scripts/sync-fixtures.mjs",
    "--isolated-data-dir",
    dataDirectory,
    ...argumentsList
  ], { cwd: projectRoot, encoding: "utf8" });
}

test("fixtures:sync dry-run previews the next round without writing any data", async () => {
  const root = await mkdtemp(join(tmpdir(), "canvases-fixture-sync-"));
  const isolatedDataDirectory = join(root, "data");
  const officialBefore = await readFile(officialFixturesPath, "utf8");
  try {
    await cp(resolve(projectRoot, "data"), isolatedDataDirectory, { recursive: true });
    const isolatedPath = join(isolatedDataDirectory, "fixtures.json");
    const isolatedBefore = await readFile(isolatedPath, "utf8");
    const execution = runSync(
      isolatedDataDirectory,
      "--dry-run",
      "--now=2026-09-11T19:40:00+08:00"
    );

    assert.equal(execution.status, 0, execution.stderr);
    assert.match(execution.stdout, /round 21 \(NEXT_ROUND_WINDOW\)/);
    assert.match(execution.stdout, /Would change: fixtures\.json/);
    assert.equal(await readFile(isolatedPath, "utf8"), isolatedBefore);
    assert.equal(await readFile(officialFixturesPath, "utf8"), officialBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fixtures:sync publishes once and is byte-stable when repeated at a fixed instant", async () => {
  const root = await mkdtemp(join(tmpdir(), "canvases-fixture-sync-"));
  const isolatedDataDirectory = join(root, "data");
  try {
    await cp(resolve(projectRoot, "data"), isolatedDataDirectory, { recursive: true });
    const isolatedPath = join(isolatedDataDirectory, "fixtures.json");
    const argumentsList = ["--now=2026-09-12T19:40:00+08:00"];

    const first = runSync(isolatedDataDirectory, ...argumentsList);
    assert.equal(first.status, 0, first.stderr);
    const firstBytes = await readFile(isolatedPath, "utf8");
    const published = JSON.parse(firstBytes);
    assert.equal(published.displayRound, 21);
    assert.equal(published.displayFixtures.length, 6);
    assert.equal(published.displayFixtures.every(({ effectiveStatus }) => effectiveStatus === "live"), true);

    const second = runSync(isolatedDataDirectory, ...argumentsList);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /already current/);
    assert.equal(await readFile(isolatedPath, "utf8"), firstBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
