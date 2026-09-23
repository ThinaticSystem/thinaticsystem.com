import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CANDIDATE_BRANCH, PAGES_SHA_MARKER, validatePagesBuildIdentity, validatePagesRoot} from './build-pages.mjs';

const candidateSha = 'a'.repeat(40);

for (const [scenario, identity] of [
  ['a wrong Pages branch', {isPages: true, branch: 'feature/other', commitSha: candidateSha, headSha: candidateSha}],
  ['a malformed Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, commitSha: 'not-a-sha', headSha: candidateSha}],
  ['a stale Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, commitSha: candidateSha, headSha: 'b'.repeat(40)}],
  ['a missing Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, commitSha: undefined, headSha: candidateSha}],
]) test(`Given a Pages build has ${scenario} when identity is validated then build identity fails closed`, () => {
  assert.throws(() => validatePagesBuildIdentity(identity));
});

test('Given an ordinary non-Pages build when identity is validated then Angular output mode remains unchanged', () => {
  assert.equal(validatePagesBuildIdentity({isPages: false, branch: undefined, commitSha: undefined, headSha: candidateSha}), null);
});

async function withPagesRoot(run) {
  const root = await mkdtemp(join(tmpdir(), 'pages-root-contract-'));
  try {
    await writeFile(join(root, 'index.html'), '<html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="main.js"></script></body></html>');
    await writeFile(join(root, 'styles.css'), 'body { color: black; }');
    await writeFile(join(root, 'main.js'), 'console.log("fixture");');
    await run(root);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

for (const [scenario, marker] of [
  ['an invalid marker', 'not-a-sha\n'],
  ['a stale marker', `${'b'.repeat(40)}\n`],
]) test(`Given the Pages root contains ${scenario} when root provenance is checked then it fails closed`, async () => {
  await withPagesRoot(async (root) => {
    await writeFile(join(root, PAGES_SHA_MARKER), marker);
    assert.throws(() => validatePagesRoot(root, candidateSha));
  });
});

test('Given the Pages root has no commit marker when provenance is checked then it fails closed', async () => {
  await withPagesRoot(async (root) => assert.throws(() => validatePagesRoot(root, candidateSha)));
});

test('Given the Pages root is missing a referenced asset when output is checked then it fails closed', async () => {
  await withPagesRoot(async (root) => {
    await writeFile(join(root, PAGES_SHA_MARKER), `${candidateSha}\n`);
    await rm(join(root, 'main.js'));
    assert.throws(() => validatePagesRoot(root, candidateSha));
  });
});
