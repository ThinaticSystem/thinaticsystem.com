import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluatePerformance} from './contract.mjs';
import {evidence} from './v3-test-fixtures.mjs';

test('v3 regression witness rejects one byte above the fixed initial cap', () => {
  const input = evidence();
  input.assets.initial.rawBytes = input.policy.caps.initial.rawBytes + 1;
  assert.equal(evaluatePerformance(input).verdict, 'FAIL');
});
