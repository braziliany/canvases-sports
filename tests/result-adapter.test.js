import test from "node:test";
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AdapterParseError,
  parseYangtzeEveningNewsResults
} from "../src/adapters/results/yangtze-evening-news.js";
import {
  createCandidateFromObservation,
  discoverResultCandidates
} from "../src/core/result-discovery.js";
import {
  AmbiguousFixtureError,
  FixtureMatchError,
  matchResultObservationToFixture
} from "../src/core/result-fixture-matcher.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";

const projectRoot = new URL("..", import.meta.url);
const snapshot = JSON.parse(await readFile(
  new URL("../data/sources/results/2026-08-29-w19-yangzi-evening-news.json", import.meta.url),
  "utf8"
));
const publishedFixtures = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));
const fixturesData = structuredClone(publishedFixtures);
for (const fixture of fixturesData.fixtures) {
  Object.assign(fixture, {
    status: "scheduled",
    effectiveStatus: "live",
    homeScore: null,
    awayScore: null
  });
}

const officialDataUrls = [
  new URL("../data/fixtures.json", import.meta.url),
  new URL("../data/standings.json", import.meta.url),
  new URL("../data/result-candidates.json", import.meta.url)
];

async function readOfficialDataBytes() {
  return Promise.all(officialDataUrls.map((url) => readFile(url)));
}

async function assertOfficialDataUnchanged(before) {
  const after = await readOfficialDataBytes();
  assert.deepEqual(after, before);
}

async function transactionArtifacts(directory) {
  const entries = await readdir(directory, { recursive: true });
  return entries.filter((name) => name.endsWith(".tmp") || name.includes(".tmp-"));
}

function candidateData(candidates = []) {
  return {
    schemaVersion: 1,
    league: {
      id: fixturesData.league.id,
      season: fixturesData.league.season
    },
    updatedAt: "2026-09-01T14:00:00Z",
    candidates: structuredClone(candidates)
  };
}

function observation(overrides = {}) {
  return {
    leagueId: "jiangsu-city-football-league",
    homeTeam: "常州",
    awayTeam: "无锡",
    homeScore: 1,
    awayScore: 5,
    source: "可靠来源 A",
    sourceType: "official-republish",
    sourceUrl: "https://source-a.example.org/result",
    observedAt: "2026-09-01T14:00:00Z",
    season: 2026,
    round: 19,
    matchDate: "2026-08-29",
    ...overrides
  };
}

test("controlled source snapshot parses three final-result observations with metadata", () => {
  const observations = parseYangtzeEveningNewsResults(snapshot);
  assert.deepEqual(
    observations.map((item) => [item.homeTeam, item.homeScore, item.awayScore, item.awayTeam]),
    [
      ["淮安", 2, 0, "连云港"],
      ["常州", 1, 5, "无锡"],
      ["扬州", 0, 1, "宿迁"]
    ]
  );
  assert.equal(observations.every((item) =>
    item.leagueId === "jiangsu-city-football-league" &&
    item.source === "扬子晚报/紫牛新闻" &&
    item.sourceType === "official-republish" &&
    item.sourceUrl === snapshot.source.url &&
    item.matchDate === "2026-08-29" && item.round === 19
  ), true);
});

test("adapter preserves zero and accepts supported non-negative score forms", () => {
  const scoreSnapshot = structuredClone(snapshot);
  scoreSnapshot.rawText = [
    "甲队0:0乙队",
    "丙队1:0丁队",
    "戊队0:2己队",
    "庚队5:1辛队"
  ].join("\n");
  assert.deepEqual(
    parseYangtzeEveningNewsResults(scoreSnapshot).map((item) => [item.homeScore, item.awayScore]),
    [[0, 0], [1, 0], [0, 2], [5, 1]]
  );
});

test("adapter fails when the controlled structure contains no parseable final result", () => {
  const invalid = structuredClone(snapshot);
  invalid.rawText = "常州队一比五无锡队";
  assert.throws(() => parseYangtzeEveningNewsResults(invalid), AdapterParseError);
});

test("fixture matcher returns the unique date-round-home-away match", () => {
  const matches = parseYangtzeEveningNewsResults(snapshot).map((item) =>
    matchResultObservationToFixture(item, fixturesData).id
  );
  assert.deepEqual(matches, [
    "2026-regular-w19-huaian-lianyungang",
    "2026-regular-w19-changzhou-wuxi",
    "2026-regular-w19-yangzhou-suqian"
  ]);
});

test("fixture matcher reports no match and ambiguity instead of choosing the first", () => {
  assert.throws(
    () => matchResultObservationToFixture(observation({ homeTeam: "不存在" }), fixturesData),
    FixtureMatchError
  );

  const ambiguousFixtures = structuredClone(fixturesData);
  ambiguousFixtures.fixtures.push({
    ...structuredClone(ambiguousFixtures.fixtures[0]),
    id: "2026-regular-w19-changzhou-wuxi-duplicate"
  });
  assert.throws(
    () => matchResultObservationToFixture(observation(), ambiguousFixtures),
    AmbiguousFixtureError
  );
});

test("observation converts to the existing ResultCandidate contract", () => {
  const item = observation();
  const fixture = matchResultObservationToFixture(item, fixturesData);
  const prepared = createCandidateFromObservation({
    observation: item,
    fixture,
    fixturesData,
    candidatesData: candidateData()
  });
  assert.deepEqual(
    [prepared.candidate.fixtureId, prepared.candidate.homeScore, prepared.candidate.awayScore,
      prepared.candidate.reviewStatus, prepared.candidate.confirmedAt],
    [fixture.id, 1, 5, "candidate", null]
  );
  assert.doesNotThrow(() => validateResultCandidates(prepared.candidatesData));
});

test("exact rediscovery is skipped without duplicating a candidate", () => {
  const observations = parseYangtzeEveningNewsResults(snapshot);
  const first = discoverResultCandidates({ observations, fixturesData, candidatesData: candidateData() });
  const second = discoverResultCandidates({
    observations,
    fixturesData,
    candidatesData: first.candidatesData
  });
  assert.equal(first.discovered.length, 3);
  assert.equal(second.discovered.length, 0);
  assert.equal(second.duplicates.length, 3);
  assert.equal(second.candidatesData.candidates.length, 3);
});

test("multiple sources and conflicting scores coexist without automatic confirmation", () => {
  const first = discoverResultCandidates({
    observations: [observation()],
    fixturesData,
    candidatesData: candidateData()
  });
  const sameScoreOtherSource = observation({
    source: "可靠来源 B",
    sourceUrl: "https://source-b.example.org/result",
    observedAt: "2026-09-01T14:01:00Z"
  });
  const second = discoverResultCandidates({
    observations: [sameScoreOtherSource],
    fixturesData,
    candidatesData: first.candidatesData
  });
  const conflictingSource = observation({
    homeScore: 2,
    source: "可靠来源 C",
    sourceUrl: "https://source-c.example.org/result",
    observedAt: "2026-09-01T14:02:00Z"
  });
  const third = discoverResultCandidates({
    observations: [conflictingSource],
    fixturesData,
    candidatesData: second.candidatesData
  });

  assert.equal(third.candidatesData.candidates.length, 3);
  assert.deepEqual(
    third.candidatesData.candidates.map((item) => [item.homeScore, item.awayScore, item.reviewStatus]),
    [[1, 5, "candidate"], [1, 5, "candidate"], [2, 5, "candidate"]]
  );
});

test("results:discover dry-run leaves every formal data file byte-identical", async () => {
  const fixturesBefore = await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8");
  const standingsBefore = await readFile(new URL("../data/standings.json", import.meta.url), "utf8");
  const candidatesBefore = await readFile(new URL("../data/result-candidates.json", import.meta.url), "utf8");
  const execution = spawnSync(process.execPath, ["scripts/discover-results.mjs", "--dry-run"], {
    cwd: fileURLToPath(projectRoot),
    encoding: "utf8"
  });
  assert.equal(execution.status, 0, execution.stderr);
  assert.match(execution.stdout, /Discovered 3 new result candidates/);
  assert.equal(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"), fixturesBefore);
  assert.equal(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"), standingsBefore);
  assert.equal(await readFile(new URL("../data/result-candidates.json", import.meta.url), "utf8"), candidatesBefore);
});

test("all result CLIs reject an invalid explicit isolation directory without touching official data", async () => {
  const officialBefore = await readOfficialDataBytes();
  const directory = await mkdtemp(join(tmpdir(), "canvases-invalid-isolation-"));
  const missingDirectory = join(directory, "does-not-exist");
  try {
    const invocations = [
      ["scripts/add-result-candidate.mjs", "--isolated-data-dir", missingDirectory],
      ["scripts/discover-results.mjs", "--isolated-data-dir", missingDirectory, "--dry-run"],
      ["scripts/confirm-result.mjs", "candidate-id", "--isolated-data-dir", missingDirectory]
    ];
    for (const argumentsList of invocations) {
      const execution = spawnSync(process.execPath, argumentsList, {
        cwd: fileURLToPath(projectRoot),
        encoding: "utf8"
      });
      assert.notEqual(execution.status, 0);
      assert.match(execution.stderr, /IsolationPathError|existing directory/);
    }
    const officialAsIsolation = spawnSync(process.execPath, [
      "scripts/discover-results.mjs",
      "--isolated-data-dir",
      fileURLToPath(new URL("../data", import.meta.url)),
      "--dry-run"
    ], {
      cwd: fileURLToPath(projectRoot),
      encoding: "utf8"
    });
    assert.notEqual(officialAsIsolation.status, 0);
    assert.match(officialAsIsolation.stderr, /must not be the official data directory/);
    await assertOfficialDataUnchanged(officialBefore);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("all result CLIs fail when the isolation directory argument is missing", async () => {
  const officialBefore = await readOfficialDataBytes();
  for (const script of [
    "scripts/add-result-candidate.mjs",
    "scripts/discover-results.mjs",
    "scripts/confirm-result.mjs"
  ]) {
    const execution = spawnSync(process.execPath, [script, "--isolated-data-dir"], {
      cwd: fileURLToPath(projectRoot),
      encoding: "utf8"
    });
    assert.notEqual(execution.status, 0);
    assert.match(execution.stderr, /requires an absolute directory path/);
  }
  await assertOfficialDataUnchanged(officialBefore);
});

test("results:discover ADD writes only an explicit Node-created isolation directory and cleans transactions", async () => {
  const officialBefore = await readOfficialDataBytes();
  const directory = await mkdtemp(join(tmpdir(), "canvases-result-discovery-"));
  const isolatedDataDirectory = join(directory, "data");
  try {
    await cp(fileURLToPath(new URL("../data", import.meta.url)), isolatedDataDirectory, {
      recursive: true
    });
    const addExecution = spawnSync(process.execPath, [
      "scripts/discover-results.mjs",
      "--isolated-data-dir",
      isolatedDataDirectory
    ], {
      cwd: fileURLToPath(projectRoot),
      encoding: "utf8",
      input: "ADD\n"
    });
    assert.equal(addExecution.status, 0, addExecution.stderr);
    assert.match(addExecution.stdout, /Added 3 discovered ResultCandidate records/);

    const isolatedCandidates = JSON.parse(await readFile(
      join(isolatedDataDirectory, "result-candidates.json"),
      "utf8"
    ));
    assert.equal(isolatedCandidates.candidates.length, 3);
    assert.equal(isolatedCandidates.candidates.every((candidate) =>
      candidate.reviewStatus === "candidate"), true);

    const duplicateExecution = spawnSync(process.execPath, [
      "scripts/discover-results.mjs",
      "--isolated-data-dir",
      isolatedDataDirectory,
      "--dry-run"
    ], {
      cwd: fileURLToPath(projectRoot),
      encoding: "utf8"
    });
    assert.equal(duplicateExecution.status, 0, duplicateExecution.stderr);
    assert.match(duplicateExecution.stdout, /Discovered 0 new result candidates/);
    assert.equal((duplicateExecution.stdout.match(/Duplicate skipped:/g) ?? []).length, 3);
    assert.deepEqual(await transactionArtifacts(isolatedDataDirectory), []);
    await assertOfficialDataUnchanged(officialBefore);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  await assert.rejects(access(directory));
});
