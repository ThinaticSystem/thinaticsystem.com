import assert from 'node:assert/strict';
import {test} from 'node:test';
import {requireSingleProbeAssertion} from './known-defect-probe-selection.mjs';

const spec = 'scripts/known-defects/fixtures/unhandled-typeerror.fixture.mjs';
const testName = 'actual unhandled asynchronous error';
const valid = () => ({numTotalTests: 1, testResults: [{name: spec, assertionResults: [{fullName: testName}]}]});

test('Given a known-defect report contains candidate assertions when the report is inspected Then returns the sole expected assertion without mutating the report', () => {
  const report = valid();
  Object.freeze(report.testResults[0].assertionResults[0]);
  Object.freeze(report.testResults[0].assertionResults);
  Object.freeze(report.testResults[0]);
  Object.freeze(report.testResults);
  Object.freeze(report);
  assert.equal(requireSingleProbeAssertion(report, spec, testName), report.testResults[0].assertionResults[0]);
});

const invalid = [
  ['null report', () => null],
  ['missing modules', () => ({numTotalTests: 1})],
  ['malformed modules', (report) => ({...report, testResults: {length: 1}})],
  ['no module', (report) => ({...report, testResults: []})],
  ['duplicate module', (report) => ({...report, testResults: [...report.testResults, ...report.testResults]})],
  ['null module', (report) => ({...report, testResults: [null]})],
  ['snapshot instead of expected file', (report) => ({...report, testResults: [{...report.testResults[0], name: '.artifacts/before/' + spec}]})],
  ['wrong file', (report) => ({...report, testResults: [{...report.testResults[0], name: 'test/runner-probes/other.test.mjs'}]})],
  ['missing assertions', (report) => ({...report, testResults: [{name: spec}]})],
  ['malformed assertions', (report) => ({...report, testResults: [{name: spec, assertionResults: {length: 1}}]})],
  ['no assertion', (report) => ({...report, testResults: [{name: spec, assertionResults: []}]})],
  ['duplicate assertion with misleading total', (report) => ({...report, testResults: [{name: spec, assertionResults: [{fullName: testName}, {fullName: testName}]}]})],
  ['null assertion', (report) => ({...report, testResults: [{name: spec, assertionResults: [null]}]})],
  ['wrong test name', (report) => ({...report, testResults: [{name: spec, assertionResults: [{fullName: 'different test'}]}]})],
  ['missing test name', (report) => ({...report, testResults: [{name: spec, assertionResults: [{}]}]})],
  ['missing total', (report) => ({...report, numTotalTests: undefined})],
  ['zero total', (report) => ({...report, numTotalTests: 0})],
  ['extra total', (report) => ({...report, numTotalTests: 2})],
  ['string total', (report) => ({...report, numTotalTests: '1'})],
];
for (const [name, mutate] of invalid) {
  test('rejects ' + name, () => {
    assert.throws(() => requireSingleProbeAssertion(mutate(valid()), spec, testName), /expected exactly one file|expected exactly one test/);
  });
}
