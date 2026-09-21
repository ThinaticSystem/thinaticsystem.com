import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {evaluatePerformance, requiredJourneyIds, validateObservation} from './contract.mjs';

// NOTE: Synthetic DTO fixtures only; no browser, app, network or child processes.
const policy = JSON.parse(readFileSync(new URL('../../test/performance-policy-v2.json', import.meta.url), 'utf8'));
const baselineHash = 'a'.repeat(64);
const candidateHash = 'b'.repeat(64);
const fixtureHash = 'c'.repeat(64);
const harnessHash = 'd'.repeat(64);
function observation(side, attemptOrdinal, calibration = false) {
  return {
    schema: 'thinaticsystem/performance-observation/v1', side, attemptOrdinal,
    browser: {version: '153.0.0.0', executablePath: '/fixture/chromium'},
    fixtureSha256: fixtureHash, harnessSha256: harnessHash,
    buildSha256: calibration || side === 'candidate' ? candidateHash : baselineHash,
    profile: {id: 'desktop-normal-loopback-v1', viewport: {width: 1280, height: 900}, reducedMotion: 'no-preference', httpCache: 'routed-disabled', cpuRate: 1, network: 'loopback-fixture'},
    journeys: requiredJourneyIds.map((id, index) => {
      const cold = index < 3;
      const interaction = index >= 8;
      return {id, entryKind: cold ? 'cold' : interaction ? 'interaction' : 'spa-warm', clockOrigin: cold ? 'navigation' : 'trusted-input', elapsedInMs: 200, ready: true,
        ...(id.startsWith('mobile.') ? {viewport: {width: 375, height: 812}} : {}),
        resources: [{id: `context-${index}:request-1`, url: 'http://127.0.0.1:4174/chunk.js', category: 'code', scope: 'action', terminal: 'finished', decodedBodySizeInBytes: 1000}], requestCount: 1};
    }), errors: [], cleanup: true,
  };
}
function evidence() {
  const observations = policy.schedule.map((side, index) => observation(side, index));
  const calibration = policy.calibrationSchedule.map((side, index) => observation(side, index, true));
  const receipt = item => ({side: item.side, attemptOrdinal: item.attemptOrdinal, status: 0, signal: null, timedOut: false, cleanup: true, stderr: '', runtime: 'v24.19.0'});
  return {observations, calibration, assets: {initial: {rawBytes: 440_000, gzipBytes: 120_000, brotliBytes: 100_000}, allEmittedJsCssRawBytes: 700_000, baseline: {initial: {rawBytes: 440_000, gzipBytes: 120_000, brotliBytes: 100_000}, allEmittedJsCssRawBytes: 700_000}}, policy: structuredClone(policy), receipts: {observations: observations.map(receipt), calibration: calibration.map(receipt)}};
}
function evaluated(mutator) { const input = evidence(); mutator(input); return evaluatePerformance(input); }
function setTiming(input, values, key = 'observations', id = 'desktop.home') {
  input[key].forEach((item, index) => { item.journeys.find(journey => journey.id === id).elapsedInMs = values[index]; });
}
function setCode(input, side, bytes, id = 'desktop.blog-article') {
  for (const item of input.observations.filter(item => item.side === side)) item.journeys.find(journey => journey.id === id).resources[0].decodedBodySizeInBytes = bytes;
}
function reviewed(input) {
  Object.assign(input.policy.warmScope, {status: 'REVIEWED_COMPATIBLE', fixtureSha256: fixtureHash, harnessSha256: harnessHash, reviewReference: 'fixture-only-review-123'});
}

test('valid evidence reports comparative coverage, no absolute or field claim', () => {
  const result = evaluatePerformance(evidence());
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  assert.equal(result.absoluteUxAcceptance, 'NOT_ESTABLISHED');
  assert.deepEqual(result.coverage.validated, requiredJourneyIds);
  assert.equal(result.coverage.field, 'UNVERIFIED');
  assert.equal(result.coverage.provider, 'UNVERIFIED');
  assert.equal(result.timingChecks.length, 11);
  assert.equal(result.sizeChecks.filter(check => check.kind === 'fixed-cap').length, 4);
  assert.equal(result.coverage.warmHistoricalScope, 'REVIEW_REQUIRED');
});

test('unvisited output material growth below the cap requires review', () => {
  const result = evaluated(input => { input.assets.baseline.allEmittedJsCssRawBytes = 500_000; input.assets.allEmittedJsCssRawBytes = 810_000; });
  assert.equal(result.verdict, 'REVIEW_REQUIRED');
  assert.equal(result.sizeChecks.find(check => check.kind === 'static-comparison' && check.id === 'allEmittedJsCssRawBytes').delta, 310_000);
});
test('small static growth stays informational and the exact material boundary is not exceeded', () => {
  for (const candidate of [500_650, 600_000]) assert.equal(evaluated(input => {
    input.assets.baseline.allEmittedJsCssRawBytes = 500_000; input.assets.allEmittedJsCssRawBytes = candidate;
  }).verdict, 'PASS_WITH_NOTES');
  assert.equal(evaluated(input => { input.assets.baseline.allEmittedJsCssRawBytes = 500_000; input.assets.allEmittedJsCssRawBytes = 600_001; }).verdict, 'REVIEW_REQUIRED');
});
test('each initial compression representation compares to the same baseline scope', () => {
  for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes']) assert.equal(evaluated(input => {
    input.assets.baseline.initial[key] = Math.floor(input.assets.initial[key] / 2);
  }).verdict, 'REVIEW_REQUIRED');
});
test('baseline static inventory rejects missing, malformed and contradictory data', () => {
  for (const mutation of [input => {delete input.assets.baseline;}, input => {input.assets.baseline.initial.rawBytes = NaN;}, input => {input.assets.baseline.allEmittedJsCssRawBytes = 0;}, input => {delete input.assets.baseline.initial.gzipBytes;}, input => {input.assets.baseline.extra = true;}]) assert.equal(evaluated(mutation).verdict, 'INVALID_EVIDENCE');
});

test('theme visual witnesses accept rendered colors and reject persisted-only contradictions', () => {
  const input = evidence();
  for (const item of [...input.observations, ...input.calibration]) {
    const journey = item.journeys.find(j => j.id === 'desktop.theme-toggle');
    journey.readinessWitness = {path:'/', targets:[{tags:'button',name:'Theme'}], viewport:{width:1280,height:900}, theme:{mode:'dark',backgroundColor:'rgb(31, 41, 55)',color:'rgb(255, 255, 255)'}};
    journey.pageClock = {startInMs:10,endInMs:210,elapsedInMs:200,timeOrigin:1_000_000,ready:true,clockOrigin:'trusted-input',witness:journey.readinessWitness};
  }
  assert.equal(evaluatePerformance(input).verdict, 'PASS_WITH_NOTES');
  input.observations[0].journeys.find(j => j.id === 'desktop.theme-toggle').readinessWitness.theme.backgroundColor = 'rgb(255, 255, 255)';
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
});
test('finite observed name aliases remain explicit and fail closed when empty', () => {
  const input = evidence(); withCollectorExtras(input);
  for (const item of [...input.observations, ...input.calibration]) {
    item.journeys[0].readinessWitness.targets = [{tags:'img', names:['Fixture illustration','**Fixture illustration**']}];
    item.journeys[0].pageClock.witness = item.journeys[0].readinessWitness;
  }
  assert.equal(evaluatePerformance(input).verdict, 'PASS_WITH_NOTES');
  input.observations[0].journeys[0].readinessWitness.targets[0].names = [];
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
});

test('validator returns errors as values and does not mutate', () => {
  const input = observation('baseline', 0);
  const before = structuredClone(input);
  assert.deepEqual(validateObservation(input), {valid: true, errors: [], notes: []});
  assert.deepEqual(input, before);
});
test('evaluation is deterministic and accepts frozen inputs without mutation', () => {
  const input = evidence();
  const before = structuredClone(input);
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
  freeze(input);
  assert.deepEqual(evaluatePerformance(input), evaluatePerformance(before));
  assert.deepEqual(input, before);
});
test('even-sample median, range, MAD and adjacent paired deltas are recomputed', () => {
  const result = evaluated(input => setTiming(input, [100, 121, 131, 110, 141, 120, 130, 151]));
  const comparison = result.timingChecks[0].comparison;
  assert.equal(comparison.baseline.median, 115);
  assert.equal(comparison.candidate.median, 136);
  assert.equal(comparison.baseline.range, 30);
  assert.equal(comparison.baseline.mad, 10);
  assert.deepEqual(comparison.pairedDeltas.values, [21, 21, 21, 21]);
  assert.deepEqual(comparison.blockDeltas, [21, 21]);
});
test('forged aggregate cannot turn a raw cap violation into PASS', () => {
  const result = evaluated(input => {
    input.aggregate = {verdict: 'PASS', timingMedian: 0};
    input.observations[0].aggregates = {median: 0};
    input.observations[0].journeys[0].summary = {ready: true};
    input.assets.initial.rawBytes = 458_753;
  });
  assert.equal(result.verdict, 'FAIL');
});
test('aggregate poison is ignored rather than evaluated', () => {
  const input = evidence(); input.aggregate = () => { throw new Error('must not execute'); };
  assert.equal(evaluatePerformance(input).verdict, 'PASS_WITH_NOTES');
});

const observationMutations = [
  ['schema', item => { item.schema = 'v4'; }],
  ['side', item => { item.side = 'other'; }],
  ['ordinal negative', item => { item.attemptOrdinal = -1; }],
  ['ordinal fraction', item => { item.attemptOrdinal = 0.5; }],
  ['unknown observation property', item => { item.a11yWaiver = true; }],
  ['missing browser', item => { delete item.browser; }],
  ['unknown browser', item => { item.browser.version = 'unknown'; }],
  ['browser relative path', item => { item.browser.executablePath = 'chromium'; }],
  ['malformed hash', item => { item.buildSha256 = 'made-up'; }],
  ['upper-case hash', item => { item.fixtureSha256 = 'A'.repeat(64); }],
  ['profile id', item => { item.profile.id = 'mobile'; }],
  ['profile CPU', item => { item.profile.cpuRate = 4; }],
  ['profile network', item => { item.profile.network = 'real'; }],
  ['profile cache', item => { item.profile.httpCache = 'enabled'; }],
  ['profile motion', item => { item.profile.reducedMotion = 'reduce'; }],
  ['desktop viewport', item => { item.profile.viewport.width = 1279; }],
  ['profile unknown key', item => { item.profile.throttled = false; }],
  ['missing journey', item => { item.journeys.pop(); }],
  ['duplicate journey', item => { item.journeys[1] = structuredClone(item.journeys[0]); }],
  ['unknown journey', item => { item.journeys[0].id = 'desktop.unknown'; }],
  ['missing mobile viewport', item => { delete item.journeys[9].viewport; }],
  ['wrong mobile viewport', item => { item.journeys[9].viewport.height = 900; }],
  ['desktop journey viewport', item => { item.journeys[0].viewport = {width: 375, height: 812}; }],
  ['wrong cold clock', item => { item.journeys[0].clockOrigin = 'trusted-input'; }],
  ['wrong warm clock', item => { item.journeys[3].clockOrigin = 'navigation'; }],
  ['wrong interaction kind', item => { item.journeys[8].entryKind = 'spa-warm'; }],
  ['not ready', item => { item.journeys[0].ready = false; }],
  ['string ready', item => { item.journeys[0].ready = 'true'; }],
  ['string timing', item => { item.journeys[0].elapsedInMs = '0'; }],
  ['negative timing', item => { item.journeys[0].elapsedInMs = -1; }],
  ['NaN timing', item => { item.journeys[0].elapsedInMs = NaN; }],
  ['infinite timing', item => { item.journeys[0].elapsedInMs = Infinity; }],
  ['unsafe timing', item => { item.journeys[0].elapsedInMs = 1e100; }],
  ['missing timing', item => { delete item.journeys[0].elapsedInMs; }],
  ['contradictory hidden timing', item => { item.journeys[0].nodeElapsedInMs = 1; }],
  ['missing resources', item => { delete item.journeys[0].resources; }],
  ['unknown resource key', item => { item.journeys[0].resources[0].cached = true; }],
  ['blank resource ID', item => { item.journeys[0].resources[0].id = ''; }],
  ['cross-journey duplicate resource', item => { item.journeys[1].resources[0].id = item.journeys[0].resources[0].id; }],
  ['duplicate resource within journey', item => { item.journeys[0].resources.push(structuredClone(item.journeys[0].resources[0])); item.journeys[0].requestCount = 2; }],
  ['URL invalid', item => { item.journeys[0].resources[0].url = 'not-a-url'; }],
  ['resource unknown category', item => { item.journeys[0].resources[0].category = 'unknown'; }],
  ['resource QA scope', item => { item.journeys[0].resources[0].scope = 'screenshot'; }],
  ['resource unfinished', item => { item.journeys[0].resources[0].terminal = 'unknown'; }],
  ['resource failed', item => { item.journeys[0].resources[0].terminal = 'failed'; }],
  ['unknown code size', item => { item.journeys[0].resources[0].decodedBodySizeInBytes = null; }],
  ['fractional code size', item => { item.journeys[0].resources[0].decodedBodySizeInBytes = 1.5; }],
  ['negative code size', item => { item.journeys[0].resources[0].decodedBodySizeInBytes = -1; }],
  ['infinite code size', item => { item.journeys[0].resources[0].decodedBodySizeInBytes = Infinity; }],
  ['byte sum overflow', item => { item.journeys[0].resources[0].decodedBodySizeInBytes = Number.MAX_SAFE_INTEGER; item.journeys[0].resources.push({...item.journeys[0].resources[0], id: 'extra'}); item.journeys[0].requestCount = 2; }],
  ['count mismatch', item => { item.journeys[0].requestCount = 2; }],
  ['count fraction', item => { item.journeys[0].requestCount = 1.1; }],
  ['count missing', item => { delete item.journeys[0].requestCount; }],
  ['errors missing', item => { delete item.errors; }],
  ['known baseline error rejected', item => { item.errors = ['NG0953']; }],
  ['axe debt rejected', item => { item.errors = ['axe button-name critical']; }],
  ['errors wrong type', item => { item.errors = {}; }],
  ['cleanup missing', item => { delete item.cleanup; }],
  ['cleanup false', item => { item.cleanup = false; }],
];
for (const [name, mutate] of observationMutations) {
  test(`observation validation rejects ${name}`, () => {
    const item = observation('baseline', 0); mutate(item);
    assert.equal(validateObservation(item).valid, false);
    assert.equal(evaluated(input => mutate(input.observations[0])).verdict, 'INVALID_EVIDENCE');
    assert.equal(evaluated(input => mutate(input.calibration[0])).verdict, 'INVALID_EVIDENCE');
  });
}

test('journey order is not identity; complete reordered ID set accepted', () => {
  assert.equal(evaluated(input => input.observations[0].journeys.reverse()).verdict, 'PASS_WITH_NOTES');
});
test('null non-code size remains UNKNOWN, never replaced by zero', () => {
  const result = evaluated(input => {
    const resource = input.observations[0].journeys[0].resources[0]; resource.category = 'image'; resource.decodedBodySizeInBytes = null;
  });
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  assert.ok(result.notes.some(note => note.includes('UNKNOWN')));
  assert.ok(result.sizeChecks.some(check => check.category === 'image' && check.status === 'UNKNOWN'));
});
test('known zero bytes and no requests are valid', () => {
  assert.equal(evaluated(input => { for (const item of [...input.observations, ...input.calibration]) { item.journeys[0].resources = []; item.journeys[0].requestCount = 0; item.journeys[0].elapsedInMs = 0; } }).verdict, 'PASS_WITH_NOTES');
});

const evidenceMutations = [
  ['observation count', input => { input.observations.pop(); }],
  ['missing calibration', input => { delete input.calibration; }],
  ['calibration count', input => { input.calibration.pop(); }],
  ['schedule changed', input => { [input.observations[0], input.observations[1]] = [input.observations[1], input.observations[0]]; }],
  ['duplicate attempt ordinal', input => { input.observations[2].attemptOrdinal = 1; }],
  ['calibration order', input => { input.calibration[0].side = 'candidate'; }],
  ['fixture drift', input => { input.observations[7].fixtureSha256 = 'e'.repeat(64); }],
  ['harness drift', input => { input.calibration[3].harnessSha256 = 'e'.repeat(64); }],
  ['baseline build drift', input => { input.observations[3].buildSha256 = 'e'.repeat(64); }],
  ['candidate build drift', input => { input.observations[7].buildSha256 = 'e'.repeat(64); }],
  ['A/A not candidate', input => { input.calibration.forEach(item => { item.buildSha256 = baselineHash; }); }],
  ['browser version drift', input => { input.observations[7].browser.version = '154.0.0.0'; }],
  ['browser executable drift', input => { input.calibration[0].browser.executablePath = '/different/chromium'; }],
  ['missing receipts', input => { delete input.receipts; }],
  ['missing receipt', input => { input.receipts.calibration.pop(); }],
  ['receipt wrong side', input => { input.receipts.observations[0].side = 'candidate'; }],
  ['receipt wrong ordinal', input => { input.receipts.observations[0].attemptOrdinal = 7; }],
  ['receipt unknown field', input => { input.receipts.observations[0].pass = true; }],
  ['receipt null status', input => { input.receipts.observations[0].status = null; }],
  ['receipt nonzero status', input => { input.receipts.observations[0].status = 1; }],
  ['receipt signal despite status zero', input => { input.receipts.observations[0].signal = 'SIGTERM'; }],
  ['receipt timeout', input => { input.receipts.calibration[0].timedOut = true; }],
  ['receipt missing timeout', input => { delete input.receipts.observations[0].timedOut; }],
  ['receipt cleanup', input => { input.receipts.observations[0].cleanup = false; }],
  ['receipt stderr', input => { input.receipts.observations[0].stderr = 'unexpected warning'; }],
  ['runtime unknown', input => { input.receipts.calibration[0].runtime = 'unknown'; }],
  ['runtime unsupported', input => { input.receipts.observations[0].runtime = 'v22.20.0'; }],
  ['runtime drift', input => { input.receipts.observations[0].runtime = 'v24.20.0'; }],
  ['policy missing', input => { delete input.policy; }],
  ['policy changed cap', input => { input.policy.caps.initial.rawBytes += 1; }],
  ['policy changed global cap', input => { input.policy.caps.allEmittedJsCssRawBytes += 1; }],
  ['policy changed warm cap', input => { input.policy.caps.warmCodeBytes['desktop.blog-article'] += 1; }],
  ['moving reference', input => { input.policy.anchor.referenceCodeBytes['desktop.blog-article'] = 7000; }],
  ['anchor identity changed', input => { input.policy.anchor.reference = 'previous-pr'; }],
  ['anchor proposal changed', input => { input.policy.anchor.proposalSha256 = 'e'.repeat(64); }],
  ['policy changed filter', input => { input.policy.materiality.timingAbsoluteFloorInMs = 51; }],
  ['policy changed resource filter', input => { input.policy.materiality.resourceAbsoluteFloorInBytes = 1025; }],
  ['policy schedule widened', input => { input.policy.schedule.push('candidate'); }],
  ['policy calibration schedule', input => { input.policy.calibrationSchedule.reverse(); input.policy.calibrationSchedule[0] = 'candidate'; }],
  ['policy unknown field', input => { input.policy.ignoreA11yDebt = true; }],
  ['policy UX claim', input => { input.policy.absoluteUxAcceptance = 'PASS'; }],
  ['warm review not bound', input => { input.policy.warmScope.status = 'REVIEWED_COMPATIBLE'; }],
  ['warm review drift', input => { reviewed(input); input.policy.warmScope.fixtureSha256 = 'e'.repeat(64); }],
  ['warm unreviewed contradiction', input => { input.policy.warmScope.reviewReference = 'not-reviewed'; }],
  ['asset missing', input => { delete input.assets.initial.gzipBytes; }],
  ['asset unknown', input => { input.assets.detailChunkRawBytes = 1; }],
  ['asset fraction', input => { input.assets.initial.rawBytes = 1.5; }],
  ['asset negative', input => { input.assets.initial.gzipBytes = -1; }],
  ['asset string', input => { input.assets.allEmittedJsCssRawBytes = '700000'; }],
  ['asset contradiction', input => { input.assets.allEmittedJsCssRawBytes = 100; }],
];
for (const [name, mutate] of evidenceMutations) test(`evaluator rejects ${name}`, () => {
  const result = evaluated(mutate); assert.equal(result.verdict, 'INVALID_EVIDENCE', result.validationErrors.join('\n')); assert.ok(result.validationErrors.length > 0);
});
for (const malformed of [null, undefined, [], 0, 'PASS', true, new Map(), {observations: undefined}]) test(`malformed root ${String(malformed)} is an explicit invalid result`, () => {
  assert.equal(evaluatePerformance(malformed).verdict, 'INVALID_EVIDENCE');
});
test('getter is never invoked', () => {
  const input = evidence(); let invoked = false;
  Object.defineProperty(input, 'policy', {get() { invoked = true; return policy; }, enumerable: true});
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE'); assert.equal(invoked, false);
});
test('cycles, sparse arrays, custom collection hooks, symbols and hidden fields fail closed', () => {
  for (const mutate of [input => { input.policy = input; }, input => { delete input.observations[0]; }, input => { input.observations.map = () => []; }, input => { input[Symbol('hidden')] = true; }, input => { Object.defineProperty(input, 'hidden', {value: true}); }]) assert.equal(evaluated(mutate).verdict, 'INVALID_EVIDENCE');
});

for (const [key, cap] of Object.entries(policy.caps.initial)) {
  test(`approved initial ${key} boundary and plus one`, () => {
    assert.equal(evaluated(input => { input.assets.initial[key] = cap; }).verdict, 'PASS_WITH_NOTES');
    assert.equal(evaluated(input => { input.assets.initial[key] = cap + 1; }).verdict, 'FAIL');
  });
}
test('fixed total asset cap prevents cumulative rolling creep', () => {
  for (const bytes of [800_000, 810_000, 819_200]) assert.equal(evaluated(input => { input.assets.allEmittedJsCssRawBytes = bytes; }).verdict, 'PASS_WITH_NOTES');
  assert.equal(evaluated(input => { input.assets.allEmittedJsCssRawBytes = 819_201; }).verdict, 'FAIL');
});
test('+650 bytes within compatible warm cap passes (5899→6549)', () => {
  const result = evaluated(input => { reviewed(input); setCode(input, 'baseline', 5899); setCode(input, 'candidate', 6549); });
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
});
test('tiny step exceeds cumulative fixed warm anchor despite moving baseline', () => {
  const result = evaluated(input => { reviewed(input); setCode(input, 'baseline', 7100); setCode(input, 'candidate', 7169); });
  assert.equal(result.verdict, 'FAIL');
});
test('fixed warm anchor detects cumulative material delta within cap', () => {
  const result = evaluated(input => { reviewed(input); setCode(input, 'baseline', 7000); setCode(input, 'candidate', 7168); });
  assert.equal(result.verdict, 'REVIEW_REQUIRED');
  assert.ok(result.sizeChecks.some(check => check.kind === 'fixed-warm-anchor' && check.status === 'MATERIAL_REGRESSION'));
});
test('incompatible rich fixture never silently rebinds old warm caps', () => {
  const result = evaluated(input => { setCode(input, 'baseline', 9000); setCode(input, 'candidate', 9000); });
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
  assert.ok(result.sizeChecks.some(check => check.kind === 'fixed-warm-anchor' && check.status === 'SCOPE_REVIEW_REQUIRED'));
});
for (const [candidateMs, expected] of [[250, 'PASS_WITH_NOTES'], [250.01, 'REVIEW_REQUIRED']]) test(`timing absolute 50ms boundary at ${candidateMs}`, () => {
  assert.equal(evaluated(input => { setTiming(input, input.observations.map(item => item.side === 'candidate' ? candidateMs : 200)); }).verdict, expected);
});
for (const [candidateMs, expected] of [[1200, 'PASS_WITH_NOTES'], [1200.01, 'REVIEW_REQUIRED']]) test(`timing relative 20% boundary at ${candidateMs}`, () => {
  assert.equal(evaluated(input => { setTiming(input, input.observations.map(item => item.side === 'candidate' ? candidateMs : 1000)); }).verdict, expected);
});
test('large ratio but tiny elapsed delta does not demand review', () => {
  assert.equal(evaluated(input => setTiming(input, input.observations.map(item => item.side === 'candidate' ? 40 : 1))).verdict, 'PASS_WITH_NOTES');
});
test('large byte improvement cannot hide slower critical path', () => {
  assert.equal(evaluated(input => { setCode(input, 'baseline', 10_000); setCode(input, 'candidate', 1000); setTiming(input, input.observations.map(item => item.side === 'candidate' ? 400 : 200)); }).verdict, 'REVIEW_REQUIRED');
});
for (const [bytes, expected] of [[2024, 'PASS_WITH_NOTES'], [2025, 'REVIEW_REQUIRED']]) test(`resource absolute 1024-byte boundary ${bytes}`, () => {
  assert.equal(evaluated(input => { setCode(input, 'candidate', bytes); }).verdict, expected);
});
for (const [bytes, expected] of [[12_000, 'PASS_WITH_NOTES'], [12_001, 'REVIEW_REQUIRED']]) test(`resource relative 20% boundary ${bytes}`, () => {
  assert.equal(evaluated(input => { setCode(input, 'baseline', 10_000); setCode(input, 'candidate', bytes); }).verdict, expected);
});
test('action/tail splitting cannot conceal total code increase', () => {
  const result = evaluated(input => {
    for (const item of input.observations.filter(item => item.side === 'candidate')) { const journey = item.journeys[4]; journey.resources[0].decodedBodySizeInBytes += 800; journey.resources.push({...journey.resources[0], id: 'tail-extra', scope: 'tail', decodedBodySizeInBytes: 800}); journey.requestCount += 1; }
  });
  assert.equal(result.verdict, 'REVIEW_REQUIRED');
});
test('additional zero-byte request is diagnostic, not automatic failure', () => {
  const result = evaluated(input => {
    for (const item of input.observations.filter(item => item.side === 'candidate')) { const journey = item.journeys[0]; journey.resources.push({...journey.resources[0], id: 'extra', decodedBodySizeInBytes: 0}); journey.requestCount += 1; }
  });
  assert.equal(result.verdict, 'PASS_WITH_NOTES');
});
test('stable but very slow lab results do not establish absolute UX acceptance', () => {
  const result = evaluated(input => { for (const item of [...input.observations, ...input.calibration]) item.journeys.forEach(journey => { journey.elapsedInMs = 100_000; }); });
  assert.equal(result.verdict, 'PASS_WITH_NOTES'); assert.equal(result.absoluteUxAcceptance, 'NOT_ESTABLISHED');
});
test('noisy A/A blocks otherwise clean comparison', () => {
  assert.equal(evaluated(input => setTiming(input, [200, 600, 200, 200], 'calibration')).verdict, 'INCONCLUSIVE');
});
test('stable A/A side bias in either direction is calibration failure', () => {
  for (const values of [[200, 400, 400, 200], [400, 200, 200, 400]]) assert.equal(evaluated(input => setTiming(input, values, 'calibration')).verdict, 'INCONCLUSIVE');
});
test('noisy comparison outlier cannot be removed or best-selected', () => {
  assert.equal(evaluated(input => setTiming(input, [200, 200, 200, 200, 200, 200, 200, 1000])).verdict, 'INCONCLUSIVE');
});
test('contradictory ABBA/BAAB blocks do not merge into a confident regression', () => {
  assert.equal(evaluated(input => setTiming(input, [200, 400, 400, 200, 100, 200, 200, 100])).verdict, 'INCONCLUSIVE');
});
test('filter-crossing blocks are inconclusive even with low within-side spread', () => {
  assert.equal(evaluated(input => setTiming(input, [200, 251, 251, 200, 249, 200, 200, 249])).verdict, 'INCONCLUSIVE');
});
test('resource A/A instability also blocks a comparative pass', () => {
  assert.equal(evaluated(input => { input.calibration[0].journeys[0].resources[0].decodedBodySizeInBytes = 5000; }).verdict, 'INCONCLUSIVE');
});
test('raw invalid evidence takes precedence over cap failure', () => {
  assert.equal(evaluated(input => { input.assets.initial.rawBytes = 500_000; input.observations[0].errors.push('pageerror'); }).verdict, 'INVALID_EVIDENCE');
});
test('independent approved cap failure remains FAIL despite noisy calibration', () => {
  assert.equal(evaluated(input => { input.assets.initial.rawBytes = 500_000; setTiming(input, [200, 900, 200, 200], 'calibration'); }).verdict, 'FAIL');
});

function withCollectorExtras(input) {
  for (const item of [...input.observations, ...input.calibration]) {
    item.notes = ['Synthetic fixture; provider performance is unverified.'];
    const home = item.journeys[0];
    home.readinessWitness = {path: '/', targets: [{tags: 'h1', text: 'ThinaticSystem'}], viewport: {width: 1280, height: 900}};
    home.pageClock = {startInMs: 0, endInMs: 200, elapsedInMs: 200, timeOrigin: 1_000_000, ready: true, clockOrigin: 'navigation', witness: structuredClone(home.readinessWitness)};
    const setup = structuredClone(home);
    setup.id = 'setup.return-home'; setup.entryKind = 'spa-warm'; setup.clockOrigin = 'trusted-input';
    setup.pageClock.clockOrigin = 'trusted-input'; setup.pageClock.startInMs = 100; setup.pageClock.endInMs = 300;
    setup.resources[0].id = 'setup-resource';
    item.setup = [setup, {id: 'qa.final-context-1', kind: 'diagnostic-screenshot', screenshot: 'qa.final-context-1.png', resources: [{...setup.resources[0], id: 'qa-resource', scope: 'tail'}], requestCount: 1}];
  }
}
test('collector page clock, semantic witness, setup and screenshots remain validated but setup excluded from metrics', () => {
  const input = evidence(); withCollectorExtras(input);
  const result = evaluatePerformance(input);
  assert.equal(result.verdict, 'PASS_WITH_NOTES', result.validationErrors.join('\n'));
  assert.equal(result.timingChecks.length, 11);
  assert.equal(result.sizeChecks.find(check => check.kind === 'resource-comparison' && check.id === 'desktop.home' && check.category === 'code' && check.scope === null).comparison.candidate.median, 1000);
});
const extraMutations = [
  ['page clock missing end', item => { delete item.journeys[0].pageClock.endInMs; }],
  ['page clock inverted', item => { item.journeys[0].pageClock.endInMs = -1; }],
  ['page clock NaN', item => { item.journeys[0].pageClock.timeOrigin = NaN; }],
  ['page clock time origin zero', item => { item.journeys[0].pageClock.timeOrigin = 0; }],
  ['navigation start nonzero', item => { item.journeys[0].pageClock.startInMs = 1; }],
  ['page clock mismatch', item => { item.journeys[0].pageClock.elapsedInMs = 0; }],
  ['journey timing forged', item => { item.journeys[0].elapsedInMs = 0; }],
  ['page clock not ready', item => { item.journeys[0].pageClock.ready = false; }],
  ['page clock wrong clock', item => { item.journeys[0].pageClock.clockOrigin = 'node'; }],
  ['missing witness', item => { delete item.journeys[0].readinessWitness; }],
  ['missing clock', item => { delete item.journeys[0].pageClock; }],
  ['witness mismatch', item => { item.journeys[0].pageClock.witness.path = '/blog'; }],
  ['witness wrong destination', item => { item.journeys[0].readinessWitness.path = '/blog'; item.journeys[0].pageClock.witness.path = '/blog'; }],
  ['witness viewport', item => { item.journeys[0].readinessWitness.viewport.width = 375; }],
  ['witness empty targets', item => { item.journeys[0].readinessWitness.targets = []; }],
  ['witness ambiguous target', item => { item.journeys[0].readinessWitness.targets[0].name = 'other'; }],
  ['witness blank target', item => { item.journeys[0].readinessWitness.targets[0].text = ''; }],
  ['witness unknown field', item => { item.journeys[0].readinessWitness.testId = 'magic'; }],
  ['notes wrong type', item => { item.notes = 'hidden warning'; }],
  ['setup wrong type', item => { item.setup = {}; }],
  ['partial failure', item => { item.setup.push({id: 'partial-failure', resources: []}); }],
  ['setup unknown ID', item => { item.setup[0].id = 'setup.unrecognized'; }],
  ['setup readiness false', item => { item.setup[0].ready = false; }],
  ['setup failed resource', item => { item.setup[0].resources[0].terminal = 'failed'; }],
  ['setup duplicate measured resource', item => { item.setup[0].resources[0].id = item.journeys[0].resources[0].id; }],
  ['setup duplicate setup resource', item => { item.setup[1].resources[0].id = item.setup[0].resources[0].id; }],
  ['setup unknown code bytes', item => { item.setup[0].resources[0].decodedBodySizeInBytes = null; }],
  ['screenshot unknown bytes', item => { item.setup[1].resources[0].decodedBodySizeInBytes = null; }],
  ['screenshot count mismatch', item => { item.setup[1].requestCount = 0; }],
  ['screenshot traversal', item => { item.setup[1].screenshot = '../qa.png'; }],
  ['screenshot duplicate ID', item => { item.setup.push(structuredClone(item.setup[1])); }],
];
for (const [name, mutate] of extraMutations) test(`collector extension rejects ${name}`, () => {
  const input = evidence(); withCollectorExtras(input); mutate(input.observations[0]);
  assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
});

test('asymmetric optional clock and readiness evidence is rejected', () => {
  for (const mutate of [input => { delete input.observations[0].journeys[0].pageClock; delete input.observations[0].journeys[0].readinessWitness; }, input => { const home = input.observations[0].journeys[0]; home.readinessWitness.targets[0].text = 'wrong content'; home.pageClock.witness.targets[0].text = 'wrong content'; }]) {
    const input = evidence(); withCollectorExtras(input); mutate(input);
    assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE');
  }
});

test('all mandatory fields reject deletion at every DTO layer', () => {
  const selectors = [input => input, input => input.policy, input => input.policy.materiality, input => input.policy.caps, input => input.policy.anchor, input => input.receipts, input => input.receipts.observations[0], input => input.observations[0], input => input.observations[0].browser, input => input.observations[0].profile, input => input.observations[0].profile.viewport, input => input.observations[0].journeys[0], input => input.observations[0].journeys[0].resources[0]];
  for (const select of selectors) for (const key of Object.keys(select(evidence()))) {
    const input = evidence(); delete select(input)[key];
    assert.equal(evaluatePerformance(input).verdict, 'INVALID_EVIDENCE', `missing ${key}`);
  }
});
