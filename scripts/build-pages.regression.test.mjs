import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
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

test('Given candidate Pages output then an ordinary build runs then deployment files and compiled Patrons endpoint return to production', () => {
  const projectRoot = resolve('.');
  const outputRoot = resolve(projectRoot, 'dist/app');
  const browserRoot = resolve(outputRoot, 'browser');
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  const candidateEnvironment = {...process.env, CF_PAGES: '1', CF_PAGES_BRANCH: 'chore/modernization-renovate', CF_PAGES_COMMIT_SHA: headSha};
  const candidateBuild = spawnSync(process.execPath, ['scripts/build-pages.mjs'], {cwd: projectRoot, env: candidateEnvironment, encoding: 'utf8'});
  assert.equal(candidateBuild.status, 0, ['candidate build failed', candidateBuild.stdout, candidateBuild.stderr].join('\n'));

  assert.equal(readFileSync(resolve(outputRoot, 'pages-commit-sha.txt'), 'utf8'), headSha + '\n');
  assert.equal(JSON.stringify(JSON.parse(readFileSync(resolve(outputRoot, '_routes.json'), 'utf8'))), JSON.stringify({version: 1, include: ['/workers/patrons'], exclude: []}));
  assert.ok(readFileSync(resolve(outputRoot, '_worker.js'), 'utf8').includes('handlePagesRequest'));
  assert.ok(existsSync(resolve(outputRoot, 'index.html')), 'candidate index must be at the configured Pages deployment root');
  assert.ok(!existsSync(browserRoot), 'candidate flattening must consume the browser subtree');
  const candidateBundles = readdirSync(outputRoot).filter((file) => file.endsWith('.js') && file !== '_worker.js').map((file) => readFileSync(resolve(outputRoot, file), 'utf8'));
  assert.ok(candidateBundles.some((bundle) => bundle.includes('/workers/patrons')), 'candidate compiled client must select the same-origin Patrons endpoint');
  assert.ok(!candidateBundles.some((bundle) => bundle.includes('https://thinaticsystem.com/workers/patrons')), 'candidate compiled client must not retain the ordinary production endpoint');

  const ordinaryEnvironment = {...process.env};
  delete ordinaryEnvironment.CF_PAGES;
  delete ordinaryEnvironment.CF_PAGES_BRANCH;
  delete ordinaryEnvironment.CF_PAGES_COMMIT_SHA;
  const ordinaryBuild = spawnSync(process.execPath, ['scripts/build-pages.mjs'], {cwd: projectRoot, env: ordinaryEnvironment, encoding: 'utf8'});
  assert.equal(ordinaryBuild.status, 0, ['ordinary build failed', ordinaryBuild.stdout, ordinaryBuild.stderr].join('\n'));

  for (const filename of ['_worker.js', '_routes.json', 'pages-commit-sha.txt', 'index.html']) {
    assert.equal(existsSync(resolve(outputRoot, filename)), false, 'ordinary deployment root must not retain candidate ' + filename);
  }
  assert.ok(existsSync(resolve(browserRoot, 'index.html')), 'ordinary Angular build output must remain at dist/app/browser');
  const ordinaryBundles = readdirSync(browserRoot).filter((file) => file.endsWith('.js')).map((file) => readFileSync(resolve(browserRoot, file), 'utf8'));
  assert.ok(ordinaryBundles.some((bundle) => bundle.includes('https://thinaticsystem.com/workers/patrons')), 'ordinary compiled client must select the existing production Patrons endpoint');
  assert.ok(!ordinaryBundles.some((bundle) => bundle.includes('"/workers/patrons"') || bundle.includes("'/workers/patrons'")), 'ordinary compiled client must not select the candidate same-origin endpoint');
});
