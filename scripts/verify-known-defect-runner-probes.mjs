import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {requireSingleProbeAssertion} from './known-defect-probe-selection.mjs';

const probeRoot = '.artifacts/known-defect-runner-probes';
mkdirSync(probeRoot, {recursive: true});
const probes = [
  ['assertion-failure', 'scripts/known-defects/fixtures/assertion-failure.fixture.mjs', {testName: 'actual assertion failure', origin: 'test', name: 'AssertionError'}],
  ['test-typeerror', 'scripts/known-defects/fixtures/test-typeerror.fixture.mjs', {testName: 'actual TypeError in test body', origin: 'test', name: 'TypeError'}],
  ['before-each-typeerror', 'scripts/known-defects/fixtures/before-each-typeerror.fixture.mjs', {testName: 'actual beforeEach failure', origin: 'beforeEach', name: 'TypeError'}],
  ['after-each-typeerror', 'scripts/known-defects/fixtures/after-each-typeerror.fixture.mjs', {testName: 'actual afterEach failure', origin: 'afterEach', name: 'TypeError'}],
  ['unhandled-typeerror', 'scripts/known-defects/fixtures/unhandled-typeerror.fixture.mjs', {testName: 'actual unhandled asynchronous error', unhandled: true}],
];
const evidence = [];
for (const [id, spec, expected] of probes) {
  const outputPath = `${probeRoot}/${id}.json`;
  rmSync(outputPath, {force: true});
  const result = spawnSync('corepack', ['pnpm', 'exec', 'vitest', 'run', spec, '--config', 'vitest.known-defects.config.mjs', '--reporter=./scripts/known-defect-reporter.mjs'], {
    encoding: 'utf8',
    env: {...process.env, KNOWN_DEFECT_REPORT_PATH: outputPath},
  });
  const report = readReport(outputPath, id);
  const assertion = requireSingleProbeAssertion(report, spec, expected.testName);
  if (result.status !== 1 || result.signal !== null || report.success !== false) {
    throw new Error(`${id}: expected a failing runner status 1, observed ${JSON.stringify({status: result.status, signal: result.signal, success: report.success})}`);
  }
  if (expected.unhandled) {
    if (report.unhandledErrors.length !== 1 || report.unhandledErrors[0].name !== 'TypeError') {
      throw new Error(`${id}: expected one authoritative unhandled TypeError, observed ${JSON.stringify(report.unhandledErrors)}`);
    }
  } else {
    const detail = assertion?.failureDetails?.[0];
    if (!detail || detail.origin !== expected.origin || detail.name !== expected.name) {
      throw new Error(`${id}: expected failure detail ${JSON.stringify(expected)}, observed ${JSON.stringify(detail)}`);
    }
  }
  evidence.push({id, spec, testName: assertion.fullName, fileCount: report.testResults.length, testCount: report.numTotalTests, exit: result.status, signal: result.signal, origin: expected.origin ?? 'unhandled', errorName: expected.name ?? report.unhandledErrors[0].name});
}
console.log(`Known-defect runner probes passed: ${evidence.length} real fixtures.`);
console.log(JSON.stringify(evidence, null, 2));

function readReport(path, id) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${id}: authoritative report missing or invalid`, {cause: error});
  }
}
