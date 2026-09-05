function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateKnownDefectRun({manifest, status, error, output}) {
  const expectedCases = manifest.cases;
  const normalizedOutput = stripAnsi(output);
  const errors = [];

  if (expectedCases.length === 0) {
    errors.push('The known-defect manifest is empty.');
  }
  if (error) {
    errors.push(`The test runner could not start: ${error.message}`);
  }
  if (status === 0) {
    errors.push('Known-defect tests unexpectedly passed; review the defect inventory.');
  }
  if (/No test files found|Test Files\s+0|Tests\s+0|Unhandled Errors|Failed to load|Cannot find module|SyntaxError|TypeError: Cannot/.test(normalizedOutput)) {
    errors.push('The runner reported setup, import, discovery, or unhandled execution failure.');
  }

  for (const testCase of expectedCases) {
    const failedCase = normalizedOutput.includes(`FAIL   thinaticsystem-com  ${testCase.spec} >`)
      && normalizedOutput.includes(`× ${testCase.testName}`);
    if (!failedCase) {
      errors.push(`Expected failing case was missing: ${testCase.spec} > ${testCase.testName}`);
    }
    const recordPattern = new RegExp(`^ ❯  thinaticsystem-com  ${escapeRegExp(testCase.spec)}`, 'gm');
    const executionRecords = normalizedOutput.match(recordPattern) ?? [];
    if (executionRecords.length !== 1) {
      errors.push(`Expected exactly one execution record for ${testCase.id}; observed ${executionRecords.length}.`);
    }
  }

  const failedTestCount = normalizedOutput.match(/Tests\s+(\d+) failed/);
  if (!failedTestCount || Number(failedTestCount[1]) !== expectedCases.length) {
    errors.push(`Expected exactly ${expectedCases.length} assertion failure(s), but the runner summary did not match.`);
  }

  return errors;
}
