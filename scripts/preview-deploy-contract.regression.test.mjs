import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, readFile, mkdir, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CANDIDATE_BRANCH, PAGES_SHA_MARKER, createPagesRoot, validateBrowserOutput, validatePagesBuildIdentity, validatePagesRoot} from './build-pages.mjs';

const candidateSha = 'a'.repeat(40);

for (const [scenario, identity] of [
  ['a wrong Pages branch', {isPages: true, branch: 'feature/other', localBranch: CANDIDATE_BRANCH, commitSha: candidateSha, headSha: candidateSha}],
  ['a malformed Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, localBranch: CANDIDATE_BRANCH, commitSha: 'not-a-sha', headSha: candidateSha}],
  ['a stale Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, localBranch: CANDIDATE_BRANCH, commitSha: candidateSha, headSha: 'b'.repeat(40)}],
  ['a missing Pages commit SHA', {isPages: true, branch: CANDIDATE_BRANCH, localBranch: CANDIDATE_BRANCH, commitSha: undefined, headSha: candidateSha}],
]) test(`Given a Pages build has ${scenario} when identity is validated then build identity fails closed`, () => {
  assert.throws(() => validatePagesBuildIdentity(identity));
});

test('Given an ordinary non-Pages build when identity is validated then Angular output mode remains unchanged', () => {
  assert.equal(validatePagesBuildIdentity({isPages: false, branch: undefined, localBranch: undefined, commitSha: undefined, headSha: candidateSha}), null);
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

test('Given noncandidate Pages metadata on a noncandidate checkout then build identity stays ordinary', () => {
  assert.equal(validatePagesBuildIdentity({isPages: true, branch: 'master', localBranch: 'master', commitSha: candidateSha, headSha: candidateSha}), null);
});

test('Given candidate checkout metadata for another branch then it fails closed', () => {
  assert.throws(() => validatePagesBuildIdentity({isPages: true, branch: 'master', localBranch: CANDIDATE_BRANCH, commitSha: candidateSha, headSha: candidateSha}));
});

test('Given detached Pages checkout with candidate metadata then exact SHA is checked while branch trust remains delegated to Pages metadata', () => {
  assert.equal(validatePagesBuildIdentity({isPages: true, branch: CANDIDATE_BRANCH, localBranch: '', commitSha: candidateSha, headSha: candidateSha}), candidateSha);
});

async function withLayoutFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'pages-layout-contract-'));
  const browserRoot = join(root, 'dist', 'app', 'browser');
  const outputRoot = join(root, 'dist', 'app');
  await mkdir(join(browserRoot, 'assets', 'data'), {recursive: true});
  await writeFile(join(browserRoot, 'index.html'), '<html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="main.js"></script></body></html>');
  await writeFile(join(browserRoot, 'styles.css'), 'body { color: black; }');
  await writeFile(join(browserRoot, 'main.js'), 'console.log("fixture");');
  await writeFile(join(browserRoot, 'assets', 'data', 'catalog.json'), '{"entries":[]}');
  try { await run({browserRoot, outputRoot}); } finally { await rm(root, {recursive: true, force: true}); }
}

test('Given Angular writes into browser when candidate Pages layout is prepared then the root contains app assets and exact SHA marker', async () => {
  await withLayoutFixture(async ({browserRoot, outputRoot}) => {
    createPagesRoot({browserRoot, outputRoot, commitSha: candidateSha});
    assert.equal(await readFile(join(outputRoot, 'index.html'), 'utf8'), '<html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="main.js"></script></body></html>');
    assert.equal(await readFile(join(outputRoot, 'assets', 'data', 'catalog.json'), 'utf8'), '{"entries":[]}');
    assert.equal(await readFile(join(outputRoot, PAGES_SHA_MARKER), 'utf8'), `${candidateSha}\n`);
    await assert.rejects(stat(browserRoot), {code: 'ENOENT'});
    await assert.rejects(stat(join(outputRoot, 'browser')), {code: 'ENOENT'});
  });
});

test('Given Angular output omits an indexed asset when Pages layout is prepared then it fails closed', async () => {
  await withLayoutFixture(async ({browserRoot}) => {
    await rm(join(browserRoot, 'main.js'));
    assert.throws(() => validateBrowserOutput(browserRoot));
  });
});

test('Given an invalid SHA when Pages layout is prepared then it fails closed', async () => {
  await withLayoutFixture(async ({browserRoot, outputRoot}) => {
    assert.throws(() => createPagesRoot({browserRoot, outputRoot, commitSha: 'wrong'}));
  });
});
