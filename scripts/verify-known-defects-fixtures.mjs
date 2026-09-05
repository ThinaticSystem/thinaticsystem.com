import assert from 'node:assert/strict';
import {validateKnownDefectRun} from './known-defect-contract.mjs';

const testCase = {
  id: 'blog-card-nested-anchor',
  spec: 'src/known-defects/blog-card.nested-anchor.spec.ts',
  testName: 'still exposes the nested interactive-anchor defect',
  suiteName: 'Known defects: BlogCardComponent',
  expected: 'assertion-failure',
};
const manifest = {schema: 'thinaticsystem-com/known-defects/v1', cases: [testCase]};
const validReport = {
  success: false,
  numTotalTests: 1,
  numFailedTests: 1,
  numPassedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [{
    status: 'failed',
    message: '',
    name: `${process.cwd()}/${testCase.spec}`,
    assertionResults: [{
      fullName: `${testCase.suiteName} ${testCase.testName}`,
      status: 'failed',
      failureMessages: ['expected failure'],
    }],
  }],
};

assert.deepEqual(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: validReport}), []);
for (const status of [null, 0, 2, -1]) {
  assert.ok(validateKnownDefectRun({manifest, status, signal: null, error: null, report: validReport}).some((message) => message.includes('must exit with status 1')));
}
assert.ok(validateKnownDefectRun({manifest, status: 134, signal: 'SIGABRT', error: null, report: validReport, stderr: 'plausible assertion output\nFATAL native runtime error'}).some((message) => message.includes('signal')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: 'SIGABRT', error: null, report: validReport}).some((message) => message.includes('signal')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: new Error('spawn failed'), report: validReport}).some((message) => message.includes('could not start')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: validReport, stderr: 'Error: unrelated setup failure'}).some((message) => message.includes('stderr diagnostics')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: null}).some((message) => message.includes('structured test report')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, success: true}}).some((message) => message.includes('expected failing run')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, numPassedTests: 1}}).some((message) => message.includes('structured test counts')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, testResults: []}}).some((message) => message.includes('structured suite')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, testResults: [validReport.testResults[0], validReport.testResults[0]]}}).some((message) => message.includes('observed 2')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, testResults: [{...validReport.testResults[0], assertionResults: [...validReport.testResults[0].assertionResults, {fullName: 'unknown', status: 'failed', failureMessages: ['unexpected']}]}]}}).some((message) => message.includes('one failed structured assertion')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, testResults: [{...validReport.testResults[0], status: 'passed'}]}}).some((message) => message.includes('one failed structured assertion')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, unhandledErrors: ['runtime failure']}}).some((message) => message.includes('runner error')));
assert.ok(validateKnownDefectRun({manifest, status: 1, signal: null, error: null, report: {...validReport, testResults: [...validReport.testResults, {name: `${process.cwd()}/src/unknown.spec.ts`, status: 'failed', assertionResults: []}]}}).some((message) => message.includes('unexpected suites')));
assert.ok(validateKnownDefectRun({manifest: {...manifest, schema: 'unknown'}, status: 1, signal: null, error: null, report: validReport}).some((message) => message.includes('schema')));
const caseWithoutExpected = {...testCase};
delete caseWithoutExpected.expected;
assert.ok(validateKnownDefectRun({manifest: {schema: manifest.schema, cases: [caseWithoutExpected]}, status: 1, signal: null, error: null, report: validReport}).some((message) => message.includes('unsupported or missing')));

console.log('Known-defect contract negative fixtures passed.');
