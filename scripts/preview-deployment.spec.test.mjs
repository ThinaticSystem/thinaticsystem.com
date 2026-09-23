import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile, mkdir, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {PAGES_SHA_MARKER, createPagesRoot, validateBrowserOutput} from './build-pages.mjs';

const commitSha = 'c'.repeat(40);

async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'pages-layout-contract-'));
  const browserRoot = join(root, 'dist', 'app', 'browser');
  const outputRoot = join(root, 'dist', 'app');
  await mkdir(join(browserRoot, 'assets', 'data'), {recursive: true});
  await writeFile(join(browserRoot, 'index.html'), '<html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="main.js"></script></body></html>');
  await writeFile(join(browserRoot, 'styles.css'), 'body { color: black; }');
  await writeFile(join(browserRoot, 'main.js'), 'console.log("fixture");');
  await writeFile(join(browserRoot, 'assets', 'data', 'catalog.json'), '{"entries":[]}');
  try {
    await run({root, browserRoot, outputRoot});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('Given Angular writes the application into browser when candidate Pages layout is prepared then the configured root contains the site and exact public SHA marker', async () => {
  await withFixture(async ({browserRoot, outputRoot}) => {
    createPagesRoot({browserRoot, outputRoot, commitSha});
    assert.equal(await readFile(join(outputRoot, 'index.html'), 'utf8'), '<html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="main.js"></script></body></html>');
    assert.equal(await readFile(join(outputRoot, 'assets', 'data', 'catalog.json'), 'utf8'), '{"entries":[]}');
    assert.equal(await readFile(join(outputRoot, PAGES_SHA_MARKER), 'utf8'), `${commitSha}\n`);
    await assert.rejects(stat(browserRoot), {code: 'ENOENT'});
    await assert.rejects(stat(join(outputRoot, 'browser')), {code: 'ENOENT'});
  });
});

test('Given Angular output omits an indexed asset when Pages layout is prepared then it fails closed before publishing', async () => {
  await withFixture(async ({browserRoot}) => {
    await rm(join(browserRoot, 'main.js'));
    assert.throws(() => validateBrowserOutput(browserRoot));
  });
});

test('Given an invalid commit SHA when Pages layout is prepared then it fails closed', async () => {
  await withFixture(async ({browserRoot, outputRoot}) => {
    assert.throws(() => createPagesRoot({browserRoot, outputRoot, commitSha: 'wrong'}));
  });
});
