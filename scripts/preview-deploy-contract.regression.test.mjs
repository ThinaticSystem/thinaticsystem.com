import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const previewJob = (text) => {
  const start = text.indexOf('\n  preview:\n');
  assert.notEqual(start, -1, 'preview job exists');
  return text.slice(start);
};

test('Given the artifact-only preview job bootstraps Wrangler when the job is executed Then it uses npm and rejects the unavailable pnpm bootstrap', async () => {
  const preview = previewJob(await readFile('.github/workflows/ci.yml', 'utf8'));
  assert.match(preview, /\n          packageManager: npm\n/, 'Wrangler bootstrap uses runner-available npm');
  assert.doesNotMatch(preview, /\n          packageManager: pnpm\n/, 'preview job does not require an unavailable pnpm executable');
});
