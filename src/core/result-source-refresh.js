import { matchResultObservationToFixture } from "./result-fixture-matcher.js";

function sameContext(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function canReuseSettledResultSnapshot({ config, snapshot, adapter, fixturesData }) {
  if (!snapshot || typeof adapter !== "function" ||
    snapshot.adapter !== config.adapter ||
    snapshot.source?.name !== config.name ||
    snapshot.source?.type !== config.type ||
    snapshot.source?.url !== config.url ||
    !sameContext(snapshot.context, config.context)) {
    return false;
  }

  try {
    const observations = adapter(snapshot);
    return observations.length > 0 && observations.every((observation) => {
      const fixture = matchResultObservationToFixture(observation, fixturesData);
      return fixture.status === "finished" &&
        fixture.homeScore === observation.homeScore &&
        fixture.awayScore === observation.awayScore;
    });
  } catch {
    return false;
  }
}
