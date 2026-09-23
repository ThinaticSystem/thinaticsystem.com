import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {createPagesRoot, normalizeModulePreloadHrefs, validateCandidateBuildConfiguration} from './build-pages.mjs';


function inspectCompiledPatronsEndpoint(bundles, expectedUrl) {
  const definitions = [];
  const reads = [];
  const requestReads = [];
  for (const [filename, text] of bundles) {
    const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (tree.parseDiagnostics.length > 0) {
      return {pass: false, reason: `parse diagnostics in ${filename}: ${tree.parseDiagnostics.length}`, definitions, reads, requestReads};
    }
    const visit = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const name = node.name;
        const isPatronsUrl = ((ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) && name.text === 'patronsUrl')
          || (ts.isComputedPropertyName(name) && (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression)) && name.expression.text === 'patronsUrl');
        if (isPatronsUrl) {
          const initializer = node.initializer;
          const isStaticString = ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer);
          definitions.push({filename, isStaticString, value: isStaticString ? initializer.text : null});
        }
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'patronsUrl') {
        reads.push(node);
        const call = node.parent;
        const isGetFirstArgument = ts.isCallExpression(call)
          && call.arguments[0] === node
          && ts.isPropertyAccessExpression(call.expression)
          && call.expression.name.text === 'get';
        if (isGetFirstArgument) requestReads.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const pass = definitions.length === 1
    && definitions[0].isStaticString
    && definitions[0].value === expectedUrl
    && reads.length === 1
    && requestReads.length === 1;
  return {pass, reason: null, definitions, reads: reads.length, requestReads: requestReads.length};
}

function assertCompiledPatronsEndpoint(bundles, expectedUrl, label) {
  const result = inspectCompiledPatronsEndpoint(bundles, expectedUrl);
  assert.equal(result.reason, null, label + ': emitted JavaScript must parse without diagnostics');
  assert.equal(result.pass, true, label + ': expected one static patronsUrl assignment with the expected decoded value and one GET use');
}

test('Given the Pages host uses its exact production selector then candidate validation locks Angular to preview', () => {
  assert.deepEqual(validateCandidateBuildConfiguration([]), []);
  assert.deepEqual(validateCandidateBuildConfiguration(['--configuration=production']), []);
  assert.deepEqual(validateCandidateBuildConfiguration(['--verbose']), ['--verbose']);
});

test('Given a candidate build receives any other configuration selector then it rejects ambiguous or competing inputs', () => {
  const rejected = [
    ['-c', 'production'], ['-c=production'], ['-cproduction'],
    ['--configuration', 'production'], ['--configuration=preview'],
    ['--configuration=development'], ['--configuration=custom'],
    ['--configuration=production', '--configuration=production'],
    ['--configuration=production,preview'], ['--configuration=production,'],
    ['--configuration=production', '--verbose'], ['--configuration='],
    ['--configurationPreview'], ['-c', 'production', '--verbose'],
  ];
  for (const args of rejected) {
    assert.throws(() => validateCandidateBuildConfiguration(args), /locked preview configuration/, args.join(' '));
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

test('compiled Patrons oracle accepts only the unique static endpoint used by GET', () => {
  const candidate = '/workers/patrons';
  const ordinary = 'https://thinaticsystem.com/workers/patrons';
  const tick = String.fromCharCode(96);
  const fixtures = [
    ['candidate backtick', 'const t={patronsUrl:' + tick + '/workers/patrons' + tick + '};client.get(t.patronsUrl)', candidate, true],
    ['ordinary backtick', 'const t={patronsUrl:' + tick + ordinary + tick + '};client.get(t.patronsUrl)', ordinary, true],
    ['candidate single quote', "const t={patronsUrl:'/workers/patrons'};client.get(t.patronsUrl)", candidate, true],
    ['ordinary double quote', 'const t={patronsUrl:"https://thinaticsystem.com/workers/patrons"};client.get(t.patronsUrl)', ordinary, true],
    ['escaped double quote', String.raw`const t={patronsUrl:"https:\u002f\u002fthinaticsystem.com/workers/patrons"};client.get(t.patronsUrl)`, ordinary, true],
    ['quoted property key', "const t={'patronsUrl':'https://thinaticsystem.com/workers/patrons'};client.get(t.patronsUrl)", ordinary, true],
    ['interpolated template', 'const t={patronsUrl:' + tick + '/workers/${suffix}' + tick + '};client.get(t.patronsUrl)', candidate, false],
    ['R26 regression: candidate selected plus unrelated production URL', 'const t={patronsUrl:' + tick + candidate + tick + '};client.get(t.patronsUrl);const unrelated=' + tick + ordinary + tick, ordinary, false],
    ['ordinary selected plus unrelated candidate URL', "const t={patronsUrl:'https://thinaticsystem.com/workers/patrons'};client.get(t.patronsUrl);const unrelated='/workers/patrons'", candidate, false],
    ['missing property with unrelated correct URL', "const t={other:'/workers/patrons'};client.get(t.patronsUrl)", candidate, false],
    ['duplicate property assignments', "const t={patronsUrl:'/workers/patrons'};const other={patronsUrl:'/workers/patrons'};client.get(t.patronsUrl)", candidate, false],
    ['dynamic value', 'const t={patronsUrl:resolveUrl()};client.get(t.patronsUrl)', candidate, false],
    ['unrelated correct URL only', "const t={other:'https://thinaticsystem.com/workers/patrons'};client.get(t.patronsUrl)", ordinary, false],
    ['property read not used for GET', "const t={patronsUrl:'/workers/patrons'};client.get('/workers/patrons')", candidate, false],
  ];
  for (const [label, text, expectedUrl, expectedPass] of fixtures) {
    const result = inspectCompiledPatronsEndpoint([['fixture.js', text]], expectedUrl);
    assert.doesNotThrow(() => result, label + ': fixture analyzer itself must not throw');
    assert.equal(result.pass, expectedPass, label + ': fixture oracle result');
    if (label.startsWith('R26 regression')) assert.equal(result.definitions[0]?.value, candidate, 'R26 counterexample retains the wrong selected endpoint');
  }
  assert.equal(fixtures.length, 14, 'keep the fixed 14-case oracle matrix');
  const malformed = inspectCompiledPatronsEndpoint([['malformed.js', 'const =']], candidate);
  assert.equal(malformed.pass, false, 'syntax errors fail closed');
  assert.match(malformed.reason, /parse diagnostics/, 'parse diagnostics are explicit');
});

test('Given candidate Pages output then an ordinary build runs then deployment files and compiled Patrons endpoint return to production', () => {
  const projectRoot = resolve('.');
  const outputRoot = resolve(projectRoot, 'dist/app');
  const browserRoot = resolve(outputRoot, 'browser');
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  const candidateEnvironment = {...process.env, CF_PAGES: '1', CF_PAGES_BRANCH: 'chore/modernization-renovate', CF_PAGES_COMMIT_SHA: headSha};
  const candidateBuild = spawnSync('corepack', ['pnpm', 'build', '--configuration=production'], {cwd: projectRoot, env: candidateEnvironment, encoding: 'utf8'});
  assert.equal(candidateBuild.status, 0, ['candidate build failed', candidateBuild.stdout, candidateBuild.stderr].join('\n'));

  assert.equal(readFileSync(resolve(outputRoot, 'pages-commit-sha.txt'), 'utf8'), headSha + '\n');
  assert.equal(JSON.stringify(JSON.parse(readFileSync(resolve(outputRoot, '_routes.json'), 'utf8'))), JSON.stringify({version: 1, include: ['/workers/patrons'], exclude: []}));
  assert.ok(readFileSync(resolve(outputRoot, '_worker.js'), 'utf8').includes('handlePagesRequest'));
  assert.ok(existsSync(resolve(outputRoot, 'index.html')), 'candidate index must be at the configured Pages deployment root');
  assert.ok(!existsSync(browserRoot), 'candidate flattening must consume the browser subtree');
  const candidateBundles = readdirSync(outputRoot).filter((file) => file.endsWith('.js')).map((file) => [file, readFileSync(resolve(outputRoot, file), 'utf8')]);
  assertCompiledPatronsEndpoint(candidateBundles, '/workers/patrons', 'candidate build');

  const ordinaryEnvironment = {...process.env};
  delete ordinaryEnvironment.CF_PAGES;
  delete ordinaryEnvironment.CF_PAGES_BRANCH;
  delete ordinaryEnvironment.CF_PAGES_COMMIT_SHA;
  const ordinaryBuild = spawnSync('corepack', ['pnpm', 'build', '--configuration=production'], {cwd: projectRoot, env: ordinaryEnvironment, encoding: 'utf8'});
  assert.equal(ordinaryBuild.status, 0, ['ordinary build failed', ordinaryBuild.stdout, ordinaryBuild.stderr].join('\n'));

  for (const filename of ['_worker.js', '_routes.json', 'pages-commit-sha.txt', 'index.html']) {
    assert.equal(existsSync(resolve(outputRoot, filename)), false, 'ordinary deployment root must not retain candidate ' + filename);
  }
  assert.ok(existsSync(resolve(browserRoot, 'index.html')), 'ordinary Angular build output must remain at dist/app/browser');
  const ordinaryBundles = readdirSync(browserRoot).filter((file) => file.endsWith('.js')).map((file) => [file, readFileSync(resolve(browserRoot, file), 'utf8')]);
  assertCompiledPatronsEndpoint(ordinaryBundles, 'https://thinaticsystem.com/workers/patrons', 'ordinary build');
});
