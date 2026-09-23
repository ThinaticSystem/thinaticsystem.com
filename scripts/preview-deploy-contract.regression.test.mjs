import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, readFile, mkdir, stat, symlink} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, realpathSync} from 'node:fs';
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

test('Given attached noncandidate checkout with candidate Pages metadata then it fails closed', () => {
  assert.throws(() => validatePagesBuildIdentity({isPages: true, branch: CANDIDATE_BRANCH, localBranch: 'master', commitSha: candidateSha, headSha: candidateSha}));
});

test('Given detached checkout refs for master and candidate share HEAD when Pages selects master then real Angular receives transparent --help', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pages-detached-shared-refs-'));
  const runGit = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  try {
    runGit('init', '--quiet', '--initial-branch=master');
    runGit('config', 'user.name', 'Pages contract fixture');
    runGit('config', 'user.email', 'pages-contract@example.invalid');
    await writeFile(join(root, 'fixture.txt'), 'same commit for both refs\n');
    runGit('add', 'fixture.txt');
    runGit('commit', '--quiet', '-m', 'fixture');
    const headSha = runGit('rev-parse', 'HEAD');
    runGit('branch', CANDIDATE_BRANCH);
    runGit('checkout', '--quiet', '--detach', 'master');
    assert.equal(runGit('branch', '--show-current'), '');
    assert.equal(runGit('rev-parse', `refs/heads/${CANDIDATE_BRANCH}`), headSha);
    assert.equal(runGit('rev-parse', 'refs/heads/master'), headSha);
    const scriptsRoot = join(root, 'scripts');
    await mkdir(scriptsRoot);
    await writeFile(join(scriptsRoot, 'build-pages.mjs'), await readFile(new URL('./build-pages.mjs', import.meta.url)));
    await symlink(realpathSync('node_modules'), join(root, 'node_modules'), 'dir');
    const result = spawnSync(process.execPath, [join(scriptsRoot, 'build-pages.mjs'), '--help'], {
      cwd: root, encoding: 'utf8',
      env: {...process.env, CF_PAGES: '1', CF_PAGES_BRANCH: 'master', CF_PAGES_COMMIT_SHA: headSha},
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Options|Arguments/, 'the real Angular CLI help path ran');
    assert.equal(existsSync(join(root, 'dist', 'app', PAGES_SHA_MARKER)), false, 'noncandidate mode adds no marker');
    assert.equal(existsSync(join(root, 'dist', 'app', 'browser')), false, '--help creates no browser output');
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('Given detached checkout and candidate Pages metadata when exact HEAD SHA is supplied then candidate identity is selected', () => {
  assert.equal(validatePagesBuildIdentity({isPages: true, branch: CANDIDATE_BRANCH, localBranch: '', commitSha: candidateSha, headSha: candidateSha}), candidateSha);
});

test('Given detached checkout and candidate Pages metadata when SHA is missing or stale then candidate build fails before Angular', () => {
  for (const commitSha of [undefined, 'b'.repeat(40), 'not-a-sha']) {
    assert.throws(() => validatePagesBuildIdentity({isPages: true, branch: CANDIDATE_BRANCH, localBranch: '', commitSha, headSha: candidateSha}));
  }
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
