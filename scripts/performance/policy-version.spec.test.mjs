import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluatePerformance, validateBaselineRuntimeIdentity} from './contract.mjs';
import {evidence} from './v3-test-fixtures.mjs';
import {evidence as v4Evidence} from './v4-test-fixtures.mjs';

const v2 = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v2.json', import.meta.url), 'utf8'));
const v3 = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v3.json', import.meta.url), 'utf8'));
const v4 = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v4.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('./fixtures/performance-baseline-v3.json', import.meta.url), 'utf8'));
const anchor = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';
const packageManager = 'pnpm@12.3.4+sha512.961aa41fb077da3a04a441d9f8e15ebc0c96da8ef710b2eb67bf9ee7cb0610eabd48f1fd85f51cffe73846785fa0f87c56a3a872a1d893f8446741b5cce45457';

test('Given the v3 policy is compared with its reviewed baseline when the policy receipt is checked Then v3 freezes the reviewed anchor and preserves v2 history', () => {
  assert.equal(v2.schema, 'thinaticsystem/performance-policy/v2');
  assert.equal(v3.schema, 'thinaticsystem/performance-policy/v3');
  assert.equal(v3.version, 'comparative-engineering-v3.0');
  assert.equal(v3.anchor.reference, `candidate-source-${anchor}`);
  assert.equal(baseline.sourceSha, anchor);
  assert.equal(baseline.meaning, 'Fixed comparative reference only; current-source adoption does not establish field UX acceptance.');
  assert.equal(baseline.runtime.node, 'v24.19.0');
  assert.equal(baseline.runtime.packageManager, packageManager);
  assert.deepEqual(validateBaselineRuntimeIdentity({sourceSha:anchor,node:'24.19.0',packageManager,fixture:baseline}), {valid:true, errors:[]});
});

test('v4 freezes the additive noise decision values, insertion order and proposal hash while preserving the v3 anchor', () => {
  const expectedKeys = ['sampleRange', 'calibrationBias', 'comparisonBlocks', 'inconsistentSignal', 'materialRegression', 'tailClaim'];
  assert.equal(v4.schema, 'thinaticsystem/performance-policy/v4');
  assert.equal(v4.version, 'comparative-engineering-v4.0');
  assert.equal(v4.anchor.id, 'source-7a835224-v2');
  assert.deepEqual(Object.keys(v4.noiseDecision), expectedKeys);
  assert.equal(createHash('sha256').update(JSON.stringify(v4.noiseDecision), 'utf8').digest('hex'), '54d9725da4cd7f300714eb42a82457ca3032941d63527d0bb3b2d02e389c1373');
  assert.equal(v4.anchor.proposalSha256, '54d9725da4cd7f300714eb42a82457ca3032941d63527d0bb3b2d02e389c1373');
  const input = v4Evidence();
  assert.equal(evaluatePerformance(input).verdict, 'PASS_WITH_NOTES');
  const reordered = Object.fromEntries([...Object.entries(input.policy.noiseDecision)].reverse());
  input.policy.noiseDecision = reordered;
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
});

test('v3 runner identity fails closed when the baseline package-manager differs from the reviewed fixture', () => {
  const result = validateBaselineRuntimeIdentity({sourceSha:anchor,node:'24.19.0',packageManager:packageManager.replace('12.3.4', '12.3.5'),fixture:baseline});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('packageManager')));
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
