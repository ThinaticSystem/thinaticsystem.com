/**
 * Require the authoritative report to contain exactly the requested file and case.
 * Positional Vitest filters also match backup paths; counters alone do not prove identity.
 * @returns The original sole assertion; the report is not mutated.
 * @throws If discovery is missing, ambiguous, malformed, or names a different case.
 */
export function requireSingleProbeAssertion(report, spec, testName) {
  const modules = report?.testResults;
  if (!Array.isArray(modules) || modules.length !== 1 || modules[0]?.name !== spec) {
    throw new Error(spec + ': expected exactly one file with the requested path');
  }
  const assertions = modules[0].assertionResults;
  if (!Array.isArray(assertions) || assertions.length !== 1 || report.numTotalTests !== 1 || assertions[0]?.fullName !== testName) {
    throw new Error(spec + ': expected exactly one test named ' + JSON.stringify(testName));
  }
  return assertions[0];
}
