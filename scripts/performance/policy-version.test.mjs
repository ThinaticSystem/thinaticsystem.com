import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const v2 = JSON.parse(readFileSync('test/performance-policy-v2.json', 'utf8'));
const v3 = JSON.parse(readFileSync('test/performance-policy-v3.json', 'utf8'));
const baseline = JSON.parse(readFileSync('test/performance-baseline-v3.json', 'utf8'));
const runner = readFileSync('scripts/performance/run.mjs', 'utf8');

test('v3 freezes the current source once without rewriting v2 history', () => {
  assert.equal(v2.schema, 'thinaticsystem/performance-policy/v2');
  assert.equal(v3.schema, 'thinaticsystem/performance-policy/v3');
  assert.equal(v3.version, 'comparative-engineering-v3.0');
  assert.equal(v3.anchor.reference, 'candidate-source-7a8352242951516a2380e8fc69c5fb902b0c0e5d');
  assert.equal(v3.warmScope.status, 'REVIEWED_COMPATIBLE');
  assert.match(v3.warmScope.fixtureSha256, /^[a-f0-9]{64}$/);
  assert.match(v3.warmScope.harnessSha256, /^[a-f0-9]{64}$/);
  assert.equal(baseline.schema, 'thinaticsystem/performance-baseline/v3');
  assert.equal(baseline.sourceSha, '7a8352242951516a2380e8fc69c5fb902b0c0e5d');
  assert.equal(baseline.meaning, 'Fixed comparative reference only; current-source adoption does not establish field UX acceptance.');
  assert.match(runner, /const baselineSha = '7a8352242951516a2380e8fc69c5fb902b0c0e5d'/);
  assert.match(runner, /performance-policy-v3\.json/);
  assert.ok(runner.includes("policySha256:hash('test/performance-policy-v3.json')"));
});
