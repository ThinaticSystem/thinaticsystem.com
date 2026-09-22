import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {journeyNames, timingSubstrate, validateAttempt, combineAttempts, policy} from './paired-performance-contract.mjs';
import {collectInitialAssets} from './performance-check.mjs';

const debt = JSON.parse(readFileSync('test/paired-baseline-control-v2.json'));
const browser = {name: 'Chromium', version: '153.0.8010.12', executablePath: '/fixture-only/chromium'};
function fixture(side = 'candidate') {
  const evidence = {schema: 'thinaticsystem-modernization/browser-smoke/v4', browser, toolchain: {node:'v24.19.0',playwright:'1.63.0',axe:'4.13.0'}, repeatCount: 1, timingSubstrate, runs: [{repeat: 1, browser, journeys: journeyNames.map(name => ({name, elapsedInMs: 100, requestCount: 2, resourceSummary: {count: 1, transferSizeInBytes: 100, decodedBodySizeInBytes: 50}})), a11y: debt.axe.map(scan => ({name: scan.name, testEngine:{version:'4.13.0'}, violations: side === 'baseline' ? scan.violations.map(v => ({id: v.id, impact: v.impact, nodes: v.targets.map(target => ({target, html: '<fixture>'}))})) : []})), consoleErrors: [], pageErrors: [], failedRequests: [], blockedExternalRequests: [], observations: [{name: 'desktop.theme-toggle', keyboard: true, focused: true}, {name: 'mobile.viewport-and-reflow', viewport: {width: 375, height: 812}, reflow: {clientWidth: 375, scrollWidth: 375}, keyboardMenu: true, reducedMotion: 'reduce'}]}]};
  return structuredClone({side, evidence, debt, browser, receipt: {status: side === 'baseline' ? 1 : 0, signal: null, error: null, timedOut: false, stderr: ''}});
}

test('accept complete candidate and precisely scoped historical control, not product PASS', () => {
  assert.deepEqual(validateAttempt(fixture()), []);
  const base = fixture('baseline');
  assert.deepEqual(validateAttempt(base), []);
  base.evidence.runs[0].pageErrors = Array.from({length: 2}, () => ({message: 'NG0953', url: 'http://127.0.0.1:4174/'}));
  assert.deepEqual(validateAttempt(base), []);
});

const negatives = {
  'legacy schema': f => { f.evidence.schema = 'thinaticsystem-modernization/browser-smoke/v3'; },
  'missing schema': f => { delete f.evidence.schema; },
  'font mismatch': f => { f.evidence.timingSubstrate.font.sha256 = 'other'; },
  'font missing on both sides': f => { delete f.evidence.timingSubstrate.font; },
  'browser mismatch': f => { f.browser = {...f.browser, version: '142.0.0.0'}; },
  'browser absent': f => { delete f.evidence.browser; },
  'readiness mismatch': f => { f.evidence.timingSubstrate.readiness = 'sleep'; },
  'theme mismatch': f => { f.evidence.timingSubstrate.initialTheme = 'dark'; },
  'fixture mismatch': f => { f.evidence.timingSubstrate.fixture = 'live'; },
  'missing raw run': f => { f.evidence.runs = []; },
  'repeat mismatch': f => { f.evidence.repeatCount = 4; },
  'missing journey': f => { f.evidence.runs[0].journeys.pop(); },
  'duplicate journey': f => { f.evidence.runs[0].journeys[1] = f.evidence.runs[0].journeys[0]; },
  'missing timing': f => { delete f.evidence.runs[0].journeys[0].elapsedInMs; },
  'NaN timing': f => { f.evidence.runs[0].journeys[0].elapsedInMs = NaN; },
  'missing bytes': f => { delete f.evidence.runs[0].journeys[0].resourceSummary; },
  'negative requests': f => { f.evidence.runs[0].journeys[0].requestCount = -1; },
  'console runtime error': f => { f.evidence.runs[0].consoleErrors.push({text: 'TypeError'}); },
  'missing error inventory': f => { delete f.evidence.runs[0].pageErrors; },
  'network error': f => { f.evidence.runs[0].failedRequests.push({url: 'missing'}); },
  'external request': f => { f.evidence.runs[0].blockedExternalRequests.push({url: 'live'}); },
  'candidate NG0953': f => { f.evidence.runs[0].pageErrors.push({message: 'NG0953', url: 'http://127.0.0.1:4174/'}); },
  'candidate axe': f => { f.evidence.runs[0].a11y[0].violations.push({id: 'button-name'}); },
  'missing axe scan': f => { f.evidence.runs[0].a11y.pop(); },
  'wrong viewport': f => { f.evidence.runs[0].observations[1].viewport.width = 1280; },
  'timeout with complete JSON': f => { f.receipt.timedOut = true; },
  'signal with complete JSON': f => { f.receipt.signal = 'SIGTERM'; },
  'spawn error with complete JSON': f => { f.receipt.error = 'ENOENT'; },
  'stderr with complete JSON': f => { f.receipt.stderr = 'setup crashed'; },
  'wrong exit': f => { f.receipt.status = 2; },
};
for (const [name, mutate] of Object.entries(negatives)) test(`reject ${name}`, () => {
  const f = fixture(); mutate(f); assert.notEqual(validateAttempt(f).length, 0);
});
for (const [name, mutate] of Object.entries({
  'wrong impact': f => { f.evidence.runs[0].a11y[2].violations[0].impact='moderate'; },
  'missing v2 contrast': f => { f.evidence.runs[0].a11y[2].violations.shift(); },
  'stale axe': f => { f.evidence.runs[0].a11y[2].testEngine.version='4.10.2'; },
  'different contrast target': f => { f.evidence.runs[0].a11y[2].violations[0].nodes[0].target=['other']; },
  'unexpected baseline pass': f => { f.receipt.status = 0; },
  'missing known axe': f => { f.evidence.runs[0].a11y[0].violations.pop(); },
  'unknown axe node': f => { f.evidence.runs[0].a11y[0].violations[0].nodes.push({target: ['other']}); },
  'unknown baseline page error': f => { f.evidence.runs[0].pageErrors.push({message: 'NG0953 plus TypeError', url: 'http://127.0.0.1:4174/'}); },
  'known message wrong route': f => { f.evidence.runs[0].pageErrors.push({message: 'NG0953', url: 'http://127.0.0.1:4174/blog'}); },
  'excess known error': f => { f.evidence.runs[0].pageErrors = Array.from({length: 3}, () => ({message: 'NG0953', url: 'http://127.0.0.1:4174/'})); },
})) test(`reject ${name}`, () => { const f = fixture('baseline'); mutate(f); assert.notEqual(validateAttempt(f).length, 0); });

test('aggregate requires all four rows and recomputes rather than trusting supplied medians', () => {
  const rows = [100, 120, 130, 90].map(time => { const e = fixture().evidence; e.runs[0].journeys.forEach(j => { j.elapsedInMs = time; }); e.aggregate = {fake: true}; return e; });
  assert.equal(combineAttempts(rows).aggregate.journeys['desktop.home'].medianInMs, 110);
  assert.throws(() => combineAttempts(rows.slice(0, 3)));
});

test('real child crash, timeout and missing executable cannot masquerade as known baseline', () => {
  for (const [exe, args, timeout] of [[process.execPath, ['-e', 'process.exit(2)'], 2_000], [process.execPath, ['-e', 'setInterval(()=>{},1000)'], 50], ['/nonexistent-paired-test-executable', [], 2_000]]) {
    const child = spawnSync(exe, args, {timeout, encoding: 'utf8'});
    const f = fixture('baseline');
    f.receipt = {status: child.status, signal: child.signal, error: child.error?.message ?? null, timedOut: child.error?.code === 'ETIMEDOUT', stderr: child.stderr ?? ''};
    assert.notEqual(validateAttempt(f).length, 0);
  }
});

test('actual comparison CLI rejects regression in timing/initial/request/route and mismatched v4', () => {
  mkdirSync('.artifacts/paired-ci', {recursive: true});
  const dir = mkdtempSync(resolve('.artifacts/paired-ci/fixture-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<script src="app.js"></script>');
    writeFileSync(join(dir, 'app.js'), 'console.log("test fixture only");');
    const evidence = combineAttempts(Array.from({length: 4}, () => fixture().evidence));
    const baseline = {baseSha: debt.baseSha, schema: evidence.schema, timingSubstrate, browser, initial: collectInitialAssets(dir).total, policy, journeys: Object.fromEntries(journeyNames.map(name => [name, {medianInMs: 100, requestCount: 2}])), routeResources: Object.fromEntries(journeyNames.map(name => [name, {rawBytes: 50, requestCount: 1}]))};
    const changes = [null, b => { b.journeys['desktop.home'].medianInMs = 10; }, b => { b.initial.rawBytes -= 1; }, b => { b.journeys['desktop.home'].requestCount = 1; }, b => { b.routeResources['desktop.home'].rawBytes = 49; }, b => { b.schema = 'v3'; }, b => { b.timingSubstrate.font.sha256 = 'mismatch'; }, b => { b.browser.version = '140.0.0.0'; }];
    for (const change of changes) {
      const b = structuredClone(baseline); if (change) change(b);
      writeFileSync(join(dir, 'baseline.json'), JSON.stringify(b)); writeFileSync(join(dir, 'candidate.json'), JSON.stringify(evidence));
      const child = spawnSync(process.execPath, ['scripts/performance-check.mjs'], {encoding: 'utf8', env: {...process.env, DIST_ROOT: dir, PERFORMANCE_BASELINE: join(dir, 'baseline.json'), EVIDENCE_OUTPUT: join(dir, 'candidate.json'), PERFORMANCE_OUTPUT: join(dir, 'performance.json')}});
      assert.equal(child.signal, null); assert.equal(child.status, change ? 1 : 0, child.stderr);
    }
  } finally { rmSync(dir, {recursive: true, force: true}); }
});


test('standalone comparison rejects schema mixing in BOTH directions, retains v3/v3 and v4/v4', () => {
  const dir = mkdtempSync(resolve('.artifacts/paired-ci/schema-fixture-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<script src="app.js"></script>');
    writeFileSync(join(dir, 'app.js'), '/* fixture only */');
    for (const [candidateVersion, baselineVersion] of [['v4','v4'], ['v3','v4'], ['v4','v3'], ['v3','v3']]) {
      const evidence = combineAttempts(Array.from({length: 4}, () => fixture().evidence));
      const baseline = {baseSha: debt.baseSha, schema: evidence.schema, timingSubstrate: structuredClone(timingSubstrate), browser, initial: collectInitialAssets(dir).total, policy, journeys: Object.fromEntries(journeyNames.map(name => [name, {medianInMs:100, requestCount:2}]))};
      for (const [record, version] of [[evidence,candidateVersion],[baseline,baselineVersion]]) if (version === 'v3') {
        record.schema = 'thinaticsystem-modernization/browser-smoke/v3';
        record.timingSubstrate = {...record.timingSubstrate, readiness: 'waitForVisualReady before timer stop'};
      }
      writeFileSync(join(dir,'candidate.json'),JSON.stringify(evidence)); writeFileSync(join(dir,'baseline.json'),JSON.stringify(baseline));
      const r = spawnSync(process.execPath,['scripts/performance-check.mjs'],{timeout:5_000,encoding:'utf8',env:{...process.env,DIST_ROOT:dir,EVIDENCE_OUTPUT:join(dir,'candidate.json'),PERFORMANCE_BASELINE:join(dir,'baseline.json'),PERFORMANCE_OUTPUT:join(dir,'result.json')}});
      assert.equal(r.error, undefined); assert.equal(r.signal,null);
      assert.equal(r.status, candidateVersion === baselineVersion ? 0 : 1, candidateVersion + '/' + baselineVersion + ': ' + r.stderr);
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
