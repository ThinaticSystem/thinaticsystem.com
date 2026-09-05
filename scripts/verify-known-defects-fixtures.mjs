import assert from 'node:assert/strict';
import {validateKnownDefectRun} from './known-defect-contract.mjs';

const testCase = {
  id: 'blog-card-nested-anchor',
  spec: 'src/known-defects/blog-card.nested-anchor.spec.ts',
  testName: 'still exposes the nested interactive-anchor defect',
};
const manifest = {cases: [testCase]};
const validOutput = [
  ` ❯  thinaticsystem-com  ${testCase.spec} (1 test | 1 failed) 10ms`,
  `     × ${testCase.testName} 9ms`,
  ` FAIL   thinaticsystem-com  ${testCase.spec} > Known defects: BlogCardComponent > ${testCase.testName}`,
  ' Test Files  1 failed (1)',
  '      Tests  1 failed (1)',
].join('\n');

assert.deepEqual(validateKnownDefectRun({manifest, status: 1, error: null, output: validOutput}), []);
assert.ok(validateKnownDefectRun({
  manifest,
  status: 1,
  error: null,
  output: 'Error: Cannot find module "vitest"',
}).some((message) => message.includes('setup, import')));
assert.ok(validateKnownDefectRun({
  manifest,
  status: 1,
  error: null,
  output: ' Test Files  1 failed (1)\n      Tests  1 failed (1)',
}).some((message) => message.includes('missing')));
assert.ok(validateKnownDefectRun({manifest, status: 0, error: null, output: ' Test Files  1 passed (1)\n      Tests  1 passed (1)'}).some((message) => message.includes('unexpectedly passed')));
assert.ok(validateKnownDefectRun({
  manifest,
  status: 1,
  error: null,
  output: `${validOutput}\n${validOutput}`,
}).some((message) => message.includes('observed 2')));

console.log('Known-defect contract negative fixtures passed.');
