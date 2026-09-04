export function evaluateGitSyncGate({ hasChanges, validationPassed, testsPassed }) {
  if (!validationPassed) return { commitEligible: false, reason: "validation failed" };
  if (!testsPassed) return { commitEligible: false, reason: "tests failed" };
  if (!hasChanges) return { commitEligible: false, reason: "no data changes" };
  return { commitEligible: true, reason: "validated data changes" };
}
