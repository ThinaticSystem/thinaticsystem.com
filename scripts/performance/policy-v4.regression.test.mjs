import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluatePerformance} from './contract.mjs';
import {evidence} from './v4-test-fixtures.mjs';

function setElapsed(input, group, values) {
  input[group].forEach((observation, index) => observation.journeys.forEach(journey => { journey.elapsedInMs = values[index]; }));
}
function evaluated(observationValues, calibrationValues = [200, 200, 200, 200]) {
  const input = evidence();
  setElapsed(input, 'observations', observationValues);
  setElapsed(input, 'calibration', calibrationValues);
  return {input, result: evaluatePerformance(input)};
}

test('v4 keeps balanced high raw-range noise diagnostic-only', () => {
  const {result} = evaluated([100, 100, 300, 300, 100, 100, 300, 300]);
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  assert.ok(result.timingChecks[0].comparison.baseline.range > result.timingChecks[0].comparison.threshold);
  assert.ok(result.timingChecks[0].comparison.candidate.range > result.timingChecks[0].comparison.threshold);
  assert.equal(result.timingChecks[0].comparison.aggregateSignalMismatch, false);
});

test('v4 rejects one-pair intermittent slowdown as inconclusive', () => {
  const {result} = evaluated([200, 260, 260, 200, 200, 200, 200, 200]);
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.deepEqual(result.timingChecks[0].comparison.blockSignals, [true, false]);
});

test('v4 retains distributed material slowdown despite high variance', () => {
  const {result} = evaluated([100, 180, 380, 100, 380, 300, 300, 380]);
  assert.equal(result.verdict, 'REVIEW_REQUIRED');
  assert.equal(result.timingChecks[0].status, 'MATERIAL_REGRESSION');
  assert.deepEqual(result.timingChecks[0].comparison.blockSignals, [true, true]);
  assert.ok(result.timingChecks[0].comparison.baseline.range > result.timingChecks[0].comparison.threshold);
});

test('v4 rejects calibration A/A median bias independently of raw range', () => {
  const {result} = evaluated([200, 200, 200, 200, 200, 200, 200, 200], [200, 270, 270, 200]);
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.equal(result.timingChecks[0].calibration.stable, false);
});

test('v4 rejects paired-versus-side aggregate signal mismatch', () => {
  const {result} = evaluated([100, 100, 250, 100, 100, 150, 150, 350]);
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.equal(result.timingChecks[0].comparison.aggregateSignalMismatch, true);
});

test('v4 rejects side-only material signal mismatch', () => {
  const {result} = evaluated([100, 100, 200, 100, 150, 100, 150, 200]);
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.equal(result.timingChecks[0].comparison.aggregateSignalMismatch, true);
});

const invalidEvidenceCases = [
  ['material static regression', input => { input.assets.allEmittedJsCssRawBytes = input.assets.baseline.allEmittedJsCssRawBytes + 200_000; }, 'FAIL'],
  ['missing sample', input => { input.observations.pop(); }],
  ['invalid sample', input => { input.observations[0].journeys[0].elapsedInMs = NaN; }],
  ['timeout receipt', input => { input.receipts.observations[0].timedOut = true; }],
  ['nonzero exit', input => { input.receipts.observations[0].status = 1; }],
  ['signal', input => { input.receipts.observations[0].signal = 'SIGTERM'; }],
  ['cleanup failure', input => { input.receipts.observations[0].cleanup = false; }],
  ['fixture identity drift', input => { input.observations[0].fixtureSha256 = 'e'.repeat(64); }],
  ['harness identity drift', input => { input.calibration[0].harnessSha256 = 'e'.repeat(64); }],
  ['readiness identity drift', input => { input.observations[0].journeys[0].ready = false; }],
  ['moved anchor', input => { input.policy.anchor.reference = 'moved'; }],
  ['changed absolute cap', input => { input.policy.caps.allEmittedJsCssRawBytes += 1; }],
  ['changed approved threshold', input => { input.policy.materiality.relativeRatio = 0.21; }],
  ['changed noise decision', input => { input.policy.noiseDecision.tailClaim = 'FIELD_SLO'; }],
];
for (const [name, mutate, expected = 'INVALID_EVIDENCE'] of invalidEvidenceCases) {
  test(`v4 fails closed for ${name}`, () => {
    const input = evidence();
    mutate(input);
    assert.equal(evaluatePerformance(input).verdict, expected);
  });
}

test('v4 does not admit reordered samples or best-sample deletion as a pass', () => {
  const input = evidence();
  input.observations.reverse();
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
  const {result} = evaluated([100, 100, 300, 300, 100, 100, 300, 300]);
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  const deleted = evidence();
  deleted.observations = deleted.observations.filter((_, index) => index !== 0);
  assert.equal(evaluatePerformance(deleted).verdict, 'INVALID_EVIDENCE');
});
