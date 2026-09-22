import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluatePerformance} from './contract.mjs';
import {evidence} from './v3-test-fixtures.mjs';

const v2 = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v2.json', import.meta.url), 'utf8'));
const v3 = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v3.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('./fixtures/performance-baseline-v3.json', import.meta.url), 'utf8'));
const anchor = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';

test('Given the v3 policy is compared with its reviewed baseline when the policy receipt is checked Then v3 freezes the reviewed anchor and preserves v2 history', () => {
  assert.equal(v2.schema, 'thinaticsystem/performance-policy/v2');
  assert.equal(v3.schema, 'thinaticsystem/performance-policy/v3');
  assert.equal(v3.version, 'comparative-engineering-v3.0');
  assert.equal(v3.anchor.reference, `candidate-source-${anchor}`);
  assert.equal(baseline.sourceSha, anchor);
  assert.equal(baseline.meaning, 'Fixed comparative reference only; current-source adoption does not establish field UX acceptance.');
});

test('Given the v3 policy is compared with its reviewed baseline when the policy receipt is checked Then real v3 evaluator passes healthy same-version evidence', () => {
  const result = evaluatePerformance(evidence());
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  assert.equal(result.absoluteUxAcceptance, 'NOT_ESTABLISHED');
});

const invalidEvidenceCases = [
  ['material regression', input => { input.assets.allEmittedJsCssRawBytes = input.assets.baseline.allEmittedJsCssRawBytes + 200_000; }, 'FAIL'],
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
];
for (const [name, mutate, expected = 'INVALID_EVIDENCE'] of invalidEvidenceCases) {
  test(`v3 evaluator fails closed for ${name}`, () => {
    const input = evidence(); mutate(input);
    assert.equal(evaluatePerformance(input).verdict, expected);
  });
}
