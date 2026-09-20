import {stripVTControlCharacters} from 'node:util';

/** Closed debt requires a real passing security suite, not an empty/no-test success. */
export function validateResolvedDebtRun({manifest, status, signal, error, report, stderr = '', openSpecs}) {
  const errors = [];
  const check = manifest?.resolvedCheck;
  if (manifest?.schema !== 'thinaticsystem-com/known-defects/v1' || !Array.isArray(manifest.cases) || manifest.cases.length !== 0 || check?.id !== 'unsafe-html-content' || check?.spec !== 'src/app/pipes/sanitize-html.pipe.spec.ts' || check?.suiteName !== 'SanitizeHtmlPipe' || !Array.isArray(check?.testNames) || check.testNames.length !== 4 || new Set(check.testNames).size !== 4 || !check.testNames.every(name => typeof name === 'string' && name.trim()) || !check.testNames.some(name => name.startsWith('[unsafe-html-content]'))) {
    errors.push('Invalid explicit security-debt resolution contract.');
    return errors;
  }
  if (!Array.isArray(openSpecs) || openSpecs.length !== 0) errors.push('Undisclosed known-defect files remain or discovery failed.');
  if (status !== 0 || signal !== null || (error !== null && error !== undefined)) errors.push('Resolved regression runner did not exit normally with status 0.');
  if (stripVTControlCharacters(stderr).trim()) errors.push('Unexpected runner stderr.');
  if (!report || report.schema !== 'thinaticsystem-com/vitest-authoritative/v1') {
    errors.push('Missing authoritative report.');
    return errors;
  }
  if (report.success !== true || report.numTotalTests !== 4 || report.numPassedTests !== 4 || report.numFailedTests !== 0 || report.numPendingTests !== 0 || report.numTodoTests !== 0 || report.numTotalTestSuites !== 2 || report.numPassedTestSuites !== 2 || report.numFailedTestSuites !== 0 || report.numPendingTestSuites !== 0) errors.push('Unexpected resolved regression counts/status.');
  if (!Array.isArray(report.unhandledErrors) || report.unhandledErrors.length !== 0 || !Array.isArray(report.runnerErrors) || report.runnerErrors.length !== 0) errors.push('Runner/collection/unhandled errors present.');
  for (const field of ['failureMessage', 'testExecError', 'runExecError']) if (report[field]) errors.push('Report-level error '+field);
  const suites = report.testResults;
  const suite = Array.isArray(suites) && suites.length === 1 ? suites[0] : null;
  if (suite?.name !== check.spec || suite?.status !== 'passed' || suite?.message || !Array.isArray(suite?.runnerErrors) || suite.runnerErrors.length !== 0 || !Array.isArray(suite?.assertionResults)) {
    errors.push('Unexpected resolved regression file identity/status.');
    return errors;
  }
  const actual = suite.assertionResults;
  if (actual.some(item => item === null || typeof item !== 'object' || Array.isArray(item) || typeof item.fullName !== 'string')) {
    errors.push('Malformed resolved assertion record.');
    return errors;
  }
  const expected = check.testNames.map(name => `${check.suiteName} ${name}`).sort();
  if (JSON.stringify(actual.map(item => item.fullName).sort()) !== JSON.stringify(expected)) errors.push('Missing, duplicate or unknown resolved regression case.');
  if (actual.some(item => item.status !== 'passed' || item.mode !== 'run' || !Array.isArray(item.failureMessages) || item.failureMessages.length !== 0 || !Array.isArray(item.failureDetails) || item.failureDetails.length !== 0 || JSON.stringify(item.ancestorTitles) !== JSON.stringify([check.suiteName]))) errors.push('Invalid resolved assertion outcome.');
  return errors;
}
