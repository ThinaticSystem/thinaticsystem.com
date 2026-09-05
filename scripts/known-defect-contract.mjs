function normalizedPath(value) {
  const normalized = String(value).replaceAll('\\', '/');
  const cwd = `${process.cwd().replaceAll('\\', '/')}/`;
  return normalized.startsWith(cwd) ? normalized.slice(cwd.length) : normalized;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function diagnosticLines(stderr) {
  return String(stderr).split('\n').map((line) => line.trim()).filter(Boolean);
}

function expectedAssertionName(testCase) {
  return `${testCase.suiteName ?? 'Known defects: BlogCardComponent'} ${testCase.testName}`;
}

export function validateKnownDefectRun({manifest, status, signal, error, report, stderr = ''}) {
  const expectedCases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  const errors = [];
  const expectedSpecs = new Set();
  const expectedIds = new Set();

  if (manifest?.schema !== 'thinaticsystem-com/known-defects/v1') errors.push('The known-defect manifest schema is missing or unsupported.');
  if (expectedCases.length === 0) errors.push('The known-defect manifest is empty or invalid.');
  for (const testCase of expectedCases) {
    if (!isRecord(testCase) || typeof testCase.id !== 'string' || typeof testCase.spec !== 'string' || typeof testCase.testName !== 'string') {
      errors.push(`The known-defect manifest contains an invalid case: ${JSON.stringify(testCase)}.`);
      continue;
    }
    if (testCase.expected !== 'assertion-failure') errors.push(`The known-defect case ${testCase.id} has an unsupported or missing expected outcome.`);
    if (testCase.suiteName !== undefined && (typeof testCase.suiteName !== 'string' || testCase.suiteName.trim() === '')) errors.push(`The known-defect case ${testCase.id} has an invalid suite name.`);
    if (expectedIds.has(testCase.id)) errors.push(`The known-defect manifest duplicates case ${testCase.id}.`);
    if (expectedSpecs.has(testCase.spec)) errors.push(`The known-defect manifest duplicates spec ${testCase.spec}.`);
    expectedIds.add(testCase.id);
    expectedSpecs.add(testCase.spec);
  }

  if (error !== null && error !== undefined) errors.push(`The test runner could not start: ${error.message ?? String(error)}`);
  if (signal !== null && signal !== undefined) errors.push(`The test runner terminated by signal: ${signal}`);
  if (!Number.isInteger(status) || status !== 1) errors.push(`The known-defect runner must exit with status 1; observed ${String(status)}.`);

  const unexpectedDiagnostics = diagnosticLines(stderr).filter((line) => !line.startsWith('[baseline-browser-mapping] '));
  if (unexpectedDiagnostics.length) errors.push(`The runner emitted unexpected stderr diagnostics: ${unexpectedDiagnostics.join(' | ')}`);

  if (!isRecord(report)) {
    errors.push('The structured test report is missing or invalid.');
    return errors;
  }
  for (const field of ['failureMessage', 'testExecError', 'runExecError', 'unhandledErrors']) {
    const value = report[field];
    if ((Array.isArray(value) && value.length > 0) || (typeof value === 'string' && value.trim() !== '')) errors.push(`The structured report contains a runner error in ${field}.`);
  }
  if (report.success !== false) errors.push('The structured report did not record an expected failing run.');
  if (report.numTotalTests !== expectedCases.length || report.numFailedTests !== expectedCases.length || report.numPassedTests !== 0 || report.numPendingTests !== 0 || report.numTodoTests !== 0) {
    errors.push(`The structured test counts did not match the manifest: ${JSON.stringify({total: report.numTotalTests, failed: report.numFailedTests, passed: report.numPassedTests, pending: report.numPendingTests, todo: report.numTodoTests})}.`);
  }

  const results = Array.isArray(report.testResults) ? report.testResults : [];
  for (const testCase of expectedCases) {
    if (!isRecord(testCase) || typeof testCase.spec !== 'string') continue;
    const matchingSuites = results.filter((suite) => isRecord(suite) && normalizedPath(suite.name) === testCase.spec);
    if (matchingSuites.length !== 1) {
      errors.push(`Expected exactly one structured suite for ${testCase.id}; observed ${matchingSuites.length}.`);
      continue;
    }
    const suite = matchingSuites[0];
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
    const matchingAssertions = assertions.filter((assertion) => isRecord(assertion) && assertion.fullName === expectedAssertionName(testCase));
    if (suite.status !== 'failed' || suite.message || assertions.length !== 1 || matchingAssertions.length !== 1 || matchingAssertions[0].status !== 'failed' || !Array.isArray(matchingAssertions[0].failureMessages) || matchingAssertions[0].failureMessages.length === 0) {
      errors.push(`Expected one failed structured assertion for ${testCase.id}; observed ${JSON.stringify({status: suite.status, message: suite.message, assertions}).slice(0, 2_000)}.`);
    }
  }

  const unexpectedSuites = results.filter((suite) => !isRecord(suite) || !expectedSpecs.has(normalizedPath(suite.name)));
  if (unexpectedSuites.length) errors.push(`The structured report included unexpected suites: ${unexpectedSuites.map((suite) => suite?.name ?? '<invalid>').join(', ')}.`);
  return errors;
}
