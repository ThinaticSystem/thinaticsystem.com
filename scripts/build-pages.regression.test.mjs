import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {createPagesRoot, normalizeModulePreloadHrefs, validateCandidateBuildConfiguration} from './build-pages.mjs';

test('Given a candidate build receives configuration overrides then it rejects both Angular configuration spellings', () => {
  assert.doesNotThrow(() => validateCandidateBuildConfiguration(['--verbose']));
  for (const args of [['-c', 'production'], ['-c=production'], ['--configuration', 'production'], ['--configuration=production']]) {
    assert.throws(() => validateCandidateBuildConfiguration(args), /locked preview configuration/);
  }
});

test('Given candidate output has a relative modulepreload when Pages emits Link headers then only that target becomes root-relative', () => {
  const html = '<link rel="modulepreload" href="chunk-DJVAsKa_.js?cache=1#part"><link rel="stylesheet" href="styles.css"><link rel="modulepreload" href="/already-root.js"><link rel="modulepreload" href="https://cdn.example.test/x.js"><link rel="modulepreload" href="data:text/javascript,x"><link rel="modulepreload" href="#fragment">';
  assert.equal(normalizeModulePreloadHrefs(html), '<link rel="modulepreload" href="/chunk-DJVAsKa_.js?cache=1#part"><link rel="stylesheet" href="styles.css"><link rel="modulepreload" href="/already-root.js"><link rel="modulepreload" href="https://cdn.example.test/x.js"><link rel="modulepreload" href="data:text/javascript,x"><link rel="modulepreload" href="#fragment">');
});

test('Given candidate browser output is flattened to the Pages root when building then the SHA marker and normalized preload survive', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pr83-pages-build-'));
  const browserRoot = resolve(temp, 'dist', 'app', 'browser');
  const outputRoot = resolve(temp, 'dist', 'app');
  const sha = 'f6fbb3f59433d678af882dbbebb7d1031245b3cc';
  try {
    mkdirSync(browserRoot, {recursive: true});
    writeFileSync(join(browserRoot, 'index.html'), '<link rel="modulepreload" href="chunk.js"><link rel="stylesheet" href="styles.css"><script type="module" src="main.js"></script>');
    writeFileSync(join(browserRoot, 'chunk.js'), 'export {};');
    writeFileSync(join(browserRoot, 'main.js'), 'import "./chunk.js";');
    writeFileSync(join(browserRoot, 'styles.css'), 'body {}');
    createPagesRoot({browserRoot, outputRoot, commitSha: sha});
    const outputHtml = readFileSync(join(outputRoot, 'index.html'), 'utf8');
    assert.match(outputHtml, /href="\/chunk\.js"/);
    assert.equal(readFileSync(join(outputRoot, 'pages-commit-sha.txt'), 'utf8'), sha + '\n');
    assert.equal(readFileSync(join(outputRoot, 'chunk.js'), 'utf8'), 'export {};');
    assert.throws(() => readFileSync(join(outputRoot, 'browser', 'index.html'), 'utf8'), {code: 'ENOENT'});
    const routes = JSON.parse(readFileSync(join(outputRoot, '_routes.json'), 'utf8'));
    assert.deepEqual(routes, {version: 1, include: ['/workers/patrons'], exclude: []});
    const worker = readFileSync(join(outputRoot, '_worker.js'), 'utf8');
    assert.match(worker, /export default \{\s*fetch\(request, env\) \{\s*return handlePagesRequest\(request, env\);/);
    assert.match(worker, /https:\/\/thinaticsystem\.com\/workers\/patrons/);
    assert.throws(() => readFileSync(join(outputRoot, 'browser', '_worker.js'), 'utf8'), {code: 'ENOENT'});
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});
