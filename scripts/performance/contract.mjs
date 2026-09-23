/**
 * Pure comparative lab gate. No filesystem, clock, process or browser imports.
 * D1 boundary: raw observations + parent-observed process receipts are the
 * substrate; authenticity, source snapshots and actual readiness remain parent
 * and collector responsibilities. This module proves DTO consistency, not origin.
 *
 * Policy schemas v2 and v3 are checked-in immutable controls. v4 is additive;
 * v2/v3 evaluation semantics remain unchanged for historical fixtures.
 * warmScope may be REVIEW_REQUIRED (diagnostic only) or REVIEWED_COMPATIBLE with
 * exact fixtureSha256, harnessSha256 and nonempty reviewReference. A new fixture
 * must not silently inherit the historical warm resource scope.
 *
 * receipts = {observations: Receipt[8], calibration: Receipt[4]} where Receipt is
 * {side,attemptOrdinal,status:0,signal:null,timedOut:false,cleanup:true,stderr:'',
 * runtime:'v24.x.y'}. Ordinals are zero-based within each schedule. Receipts are
 * parent observations, never values inferred from a child's PASS file.
 * Supplied aggregate/aggregates/summary fields are discarded and never trusted.
 * Optional collector extensions: observation.setup and observation.notes;
 * journey.pageClock and journey.readinessWitness must appear together, agree,
 * and have the same witness across both series. Elapsed time is recomputed from
 * page-clock marks when present. Setup IDs are setup.theme-light,
 * setup.return-home, setup.mobile-home and qa.final-context-N screenshots;
 * setup resources share the observation-wide uniqueness/completion checks but
 * never enter measured totals. Partial-failure setup records are invalid.
 */

export const requiredJourneyIds = Object.freeze([
  'desktop.home', 'desktop.article-cold', 'desktop.detail-cold',
  'desktop.blog-list', 'desktop.blog-article', 'desktop.blog-back',
  'desktop.discography', 'desktop.discography-detail', 'desktop.theme-toggle',
  'mobile.menu-open', 'mobile.menu-close',
]);
const schedule = ['baseline', 'candidate', 'candidate', 'baseline', 'candidate', 'baseline', 'baseline', 'candidate'];
const calibrationSchedule = schedule.slice(0, 4);
const initialCaps = {rawBytes: 458_752, gzipBytes: 131_072, brotliBytes: 114_688};
const warmCaps = {'desktop.blog-list': 20_480, 'desktop.blog-article': 7_168, 'desktop.discography': 5_120};
const fixedReferenceV2 = {'desktop.blog-list': 21_571, 'desktop.blog-article': 5_899, 'desktop.discography': 4_571};
const fixedReferenceV3 = {'desktop.blog-list': 20_340, 'desktop.blog-article': 6_549, 'desktop.discography': 4_521};
const categories = ['code', 'document', 'api', 'image', 'font', 'other'];
const scopes = ['action', 'tail'];
const aggregateKeys = ['aggregate', 'aggregates', 'summary'];
const hashPattern = /^[a-f0-9]{64}$/;
const noiseDecisionKeys = ['sampleRange', 'calibrationBias', 'comparisonBlocks', 'inconsistentSignal', 'materialRegression', 'tailClaim'];
const noiseDecision = {sampleRange: 'DIAGNOSTIC_ONLY', calibrationBias: 'INCONCLUSIVE', comparisonBlocks: 'TWO_FIXED_PAIRS', inconsistentSignal: 'INCONCLUSIVE', materialRegression: 'PAIRED_AND_SIDE_MEDIANS', tailClaim: 'NOT_ESTABLISHED'};
const noiseDecisionSha256 = '54d9725da4cd7f300714eb42a82457ca3032941d63527d0bb3b2d02e389c1373';
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const integer = value => number(value) && Number.isSafeInteger(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Capture JSON DTOs once, rejecting accessors, sparse arrays and exotic objects. */
function capture(value, ancestors = new Set(), depth = 0) {
  if (depth > 40) throw new Error('DTO nesting exceeds limit');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error('non-JSON or cyclic DTO');
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('non-plain DTO');
  const next = new Set(ancestors).add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string')) throw new Error('symbol DTO key');
  const copy = Array.isArray(value) ? [] : Object.create(null);
  if (Array.isArray(value) && Object.keys(descriptors).length !== value.length + 1) throw new Error('sparse or extended array');
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('accessor or hidden DTO field');
    if (aggregateKeys.includes(key)) continue;
    copy[key] = capture(descriptor.value, next, depth + 1);
  }
  return copy;
}
function shape(value, required, optional, path, errors) {
  if (!record(value)) { errors.push(`${path}: expected object`); return false; }
  for (const key of required) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: missing`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) errors.push(`${path}.${key}: unknown field`);
  return true;
}
function requireValue(condition, path, errors) { if (!condition) errors.push(path); }
function viewport(value, width, height, path, errors) {
  if (!shape(value, ['width', 'height'], [], path, errors)) return;
  requireValue(value.width === width && value.height === height, `${path}: unsupported viewport`, errors);
}
function sameRecord(actual, expected, path, errors) {
  if (!shape(actual, Object.keys(expected), [], path, errors)) return;
  for (const [key, value] of Object.entries(expected)) requireValue(actual[key] === value, `${path}.${key}: differs from fixed policy`, errors);
}
function equalDto(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equalDto(left[key], right[key]));
}
function inspectPageClock(journey, path, errors) {
  const clock = journey.pageClock;
  const witness = journey.readinessWitness;
  if (shape(clock, ['startInMs', 'endInMs', 'elapsedInMs', 'timeOrigin', 'ready', 'clockOrigin', 'witness'], [], `${path}.pageClock`, errors)) {
    for (const key of ['startInMs', 'endInMs', 'elapsedInMs', 'timeOrigin']) requireValue(number(clock[key]), `${path}.pageClock.${key}: invalid`, errors);
    requireValue(clock.timeOrigin > 0 && clock.endInMs >= clock.startInMs && (journey.clockOrigin !== 'navigation' || clock.startInMs === 0), `${path}.pageClock: invalid origin/order`, errors);
    requireValue(clock.endInMs - clock.startInMs === clock.elapsedInMs && clock.elapsedInMs === journey.elapsedInMs, `${path}.pageClock: elapsed contradiction`, errors);
    requireValue(clock.ready === true && clock.clockOrigin === journey.clockOrigin, `${path}.pageClock: readiness/clock contradiction`, errors);
    requireValue(equalDto(clock.witness, witness), `${path}.pageClock.witness: contradiction`, errors);
  }
  if (!shape(witness, ['path', 'targets', 'viewport'], ['theme'], `${path}.readinessWitness`, errors)) return;
  if (Object.hasOwn(witness, 'theme')) {
    const mode = journey.id === 'desktop.theme-toggle' ? 'dark' : journey.id === 'setup.theme-light' ? 'light' : null;
    if (shape(witness.theme, ['mode', 'backgroundColor', 'color'], [], `${path}.readinessWitness.theme`, errors)) {
      requireValue(mode !== null && witness.theme.mode === mode && witness.theme.backgroundColor === (mode === 'dark' ? 'rgb(31, 41, 55)' : 'rgb(255, 255, 255)') && witness.theme.color === (mode === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)'), `${path}.readinessWitness.theme: rendered state contradiction`, errors);
    }
  }
  const paths = {'desktop.home': '/', 'desktop.article-cold': '/blog/article/1', 'desktop.detail-cold': '/discography/1', 'desktop.blog-list': '/blog', 'desktop.blog-article': '/blog/article/1', 'desktop.blog-back': '/blog', 'desktop.discography': '/discography', 'desktop.discography-detail': '/discography/1', 'desktop.theme-toggle': '/', 'mobile.menu-open': '/', 'mobile.menu-close': '/', 'setup.theme-light': '/', 'setup.return-home': '/', 'setup.mobile-home': '/', 'setup.home-pixels': '/'};
  requireValue(witness.path === paths[journey.id], `${path}.readinessWitness.path: wrong destination`, errors);
  const mobile = typeof journey.id === 'string' && (journey.id.startsWith('mobile.') || journey.id === 'setup.mobile-home');
  viewport(witness.viewport, mobile ? 375 : 1280, mobile ? 812 : 900, `${path}.readinessWitness.viewport`, errors);
  if (!Array.isArray(witness.targets) || witness.targets.length === 0) { errors.push(`${path}.readinessWitness.targets: empty or missing`); return; }
  for (const [index, target] of witness.targets.entries()) {
    const at = `${path}.readinessWitness.targets[${index}]`;
    if (!shape(target, ['tags'], ['name', 'names', 'text', 'containsText'], at, errors)) continue;
    const kinds = ['name', 'names', 'text', 'containsText'].filter(key => Object.hasOwn(target, key));
    const value = target[kinds[0]];
    requireValue(text(target.tags) && kinds.length === 1 && (kinds[0] === 'names' ? Array.isArray(value) && value.length > 0 && value.every(text) && new Set(value).size === value.length : text(value)), `${at}: invalid semantic target`, errors);
  }
}
function inspectObservation(observation, path, errors, notes) {
  if (!shape(observation, ['schema', 'side', 'attemptOrdinal', 'browser', 'fixtureSha256', 'harnessSha256', 'buildSha256', 'profile', 'journeys', 'errors', 'cleanup'], ['setup', 'notes'], path, errors)) return;
  requireValue(observation.schema === 'thinaticsystem/performance-observation/v1', `${path}.schema: unsupported`, errors);
  requireValue(['baseline', 'candidate'].includes(observation.side), `${path}.side: unsupported`, errors);
  requireValue(integer(observation.attemptOrdinal), `${path}.attemptOrdinal: invalid`, errors);
  for (const key of ['fixtureSha256', 'harnessSha256', 'buildSha256']) requireValue(typeof observation[key] === 'string' && hashPattern.test(observation[key]), `${path}.${key}: invalid SHA256`, errors);
  if (shape(observation.browser, ['version', 'executablePath'], [], `${path}.browser`, errors)) {
    requireValue(typeof observation.browser.version === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(observation.browser.version), `${path}.browser.version: unknown browser`, errors);
    requireValue(text(observation.browser.executablePath) && observation.browser.executablePath.startsWith('/'), `${path}.browser.executablePath: expected absolute path`, errors);
  }
  if (shape(observation.profile, ['id', 'viewport', 'reducedMotion', 'httpCache', 'cpuRate', 'network'], [], `${path}.profile`, errors)) {
    const expected = {id: 'desktop-normal-loopback-v1', reducedMotion: 'no-preference', httpCache: 'routed-disabled', cpuRate: 1, network: 'loopback-fixture'};
    for (const [key, value] of Object.entries(expected)) requireValue(observation.profile[key] === value, `${path}.profile.${key}: unsupported`, errors);
    viewport(observation.profile.viewport, 1280, 900, `${path}.profile.viewport`, errors);
  }
  requireValue(Array.isArray(observation.errors) && observation.errors.length === 0, `${path}.errors: raw errors or missing error evidence (no historical debt waiver)`, errors);
  requireValue(observation.cleanup === true, `${path}.cleanup: not complete`, errors);
  if (Object.hasOwn(observation, 'notes')) requireValue(Array.isArray(observation.notes) && observation.notes.every(text), `${path}.notes: expected diagnostic strings`, errors);
  if (Object.hasOwn(observation, 'setup')) requireValue(Array.isArray(observation.setup), `${path}.setup: expected array`, errors);
  if (!Array.isArray(observation.journeys)) { errors.push(`${path}.journeys: missing array`); return; }
  requireValue(observation.journeys.length === requiredJourneyIds.length, `${path}.journeys: incorrect count`, errors);
  const ids = new Set();
  const resourceIds = new Set();
  const entries = [...observation.journeys, ...(Array.isArray(observation.setup) ? observation.setup : [])];
  for (const [index, journey] of entries.entries()) {
    const setup = index >= observation.journeys.length;
    const at = `${path}.${setup ? 'setup' : 'journeys'}[${setup ? index - observation.journeys.length : index}]`;
    const screenshot = setup && journey?.kind === 'diagnostic-screenshot';
    if (!shape(journey, screenshot ? ['id', 'kind', 'screenshot', 'resources', 'requestCount'] : ['id', 'entryKind', 'clockOrigin', 'elapsedInMs', 'ready', 'resources', 'requestCount'], screenshot ? [] : ['viewport', 'readinessWitness', 'pageClock'], at, errors)) continue;
    const setupId = screenshot ? /^qa\.final-context-[1-9]\d*$/.test(journey.id) : ['setup.theme-light', 'setup.return-home', 'setup.mobile-home', 'setup.home-pixels'].includes(journey.id);
    requireValue((setup ? setupId : requiredJourneyIds.includes(journey.id)) && !ids.has(journey.id), `${at}.id: unknown or duplicate`, errors);
    ids.add(journey.id);
    if (screenshot) requireValue(journey.screenshot === `${journey.id}.png`, `${at}.screenshot: invalid name`, errors);
    else {
    const cold = ['desktop.home', 'desktop.article-cold', 'desktop.detail-cold', 'setup.mobile-home', 'setup.home-pixels'].includes(journey.id);
    const interaction = ['desktop.theme-toggle', 'mobile.menu-open', 'mobile.menu-close', 'setup.theme-light'].includes(journey.id);
    requireValue(journey.entryKind === (cold ? 'cold' : interaction ? 'interaction' : 'spa-warm'), `${at}.entryKind: inconsistent`, errors);
    requireValue(journey.clockOrigin === (cold ? 'navigation' : 'trusted-input'), `${at}.clockOrigin: inconsistent`, errors);
    requireValue(number(journey.elapsedInMs), `${at}.elapsedInMs: invalid number`, errors);
    requireValue(journey.ready === true, `${at}.ready: not established`, errors);
    if (typeof journey.id === 'string' && (journey.id.startsWith('mobile.') || journey.id === 'setup.mobile-home')) viewport(journey.viewport, 375, 812, `${at}.viewport`, errors);
    else if (Object.hasOwn(journey, 'viewport')) viewport(journey.viewport, 1280, 900, `${at}.viewport`, errors);
    if (Object.hasOwn(journey, 'readinessWitness') || Object.hasOwn(journey, 'pageClock')) inspectPageClock(journey, at, errors);
    }
    if (!Array.isArray(journey.resources)) { errors.push(`${at}.resources: missing array`); continue; }
    requireValue(integer(journey.requestCount) && journey.requestCount === journey.resources.length, `${at}.requestCount: contradicts owned resources`, errors);
    let knownBytes = 0;
    for (const [resourceIndex, resource] of journey.resources.entries()) {
      const resourcePath = `${at}.resources[${resourceIndex}]`;
      if (!shape(resource, ['id', 'url', 'category', 'scope', 'terminal', 'decodedBodySizeInBytes'], [], resourcePath, errors)) continue;
      requireValue(text(resource.id) && !resourceIds.has(resource.id), `${resourcePath}.id: missing or duplicate ownership`, errors);
      resourceIds.add(resource.id);
      requireValue(text(resource.url) && /^https?:\/\/[^\s]+$/.test(resource.url), `${resourcePath}.url: invalid`, errors);
      requireValue(categories.includes(resource.category), `${resourcePath}.category: unknown`, errors);
      requireValue(scopes.includes(resource.scope), `${resourcePath}.scope: unknown`, errors);
      requireValue(resource.terminal === 'finished', `${resourcePath}.terminal: incomplete or failed`, errors);
      const bytes = resource.decodedBodySizeInBytes;
      requireValue(integer(bytes) || bytes === null && resource.category !== 'code', `${resourcePath}.decodedBodySizeInBytes: unknown code or invalid bytes`, errors);
      if (bytes === null && resource.category !== 'code') notes.push(`${resourcePath}: ${resource.category} decoded bytes UNKNOWN; not treated as zero`);
      if (integer(bytes)) knownBytes += bytes;
    }
    requireValue(integer(knownBytes), `${at}.resources: byte sum overflow`, errors);
  }
  for (const id of requiredJourneyIds) requireValue(ids.has(id), `${path}.journeys: missing ${id}`, errors);
}

/** Validate an unknown observation without mutation; errors are explicit values. */
export function validateObservation(observation) {
  const errors = [];
  const notes = [];
  try { inspectObservation(capture(observation), 'observation', errors, notes); }
  catch (error) { errors.push(`observation: ${error.message}`); }
  return {valid: errors.length === 0, errors, notes};
}

/** Validate the reviewed v3 baseline identity before the runner installs it. */
export function validateBaselineRuntimeIdentity({sourceSha, node, packageManager, fixture}) {
  const errors = [];
  if (!record(fixture)) return {valid: false, errors: ['baseline fixture: expected object']};
  requireValue(fixture.schema === 'thinaticsystem/performance-baseline/v3', 'baseline fixture: unsupported schema', errors);
  requireValue(fixture.sourceSha === sourceSha, 'baseline fixture: source SHA differs from runner anchor', errors);
  if (shape(fixture.runtime, ['node', 'packageManager'], ['playwright', 'chromium', 'fixtureSha256', 'harnessSha256', 'browser'], 'baseline fixture.runtime', errors)) {
    requireValue(fixture.runtime.node === `v${node}`, 'baseline fixture.runtime.node: differs from pinned Node identity', errors);
    requireValue(typeof packageManager === 'string' && packageManager === fixture.runtime.packageManager, 'baseline fixture.runtime.packageManager: differs from worktree packageManager', errors);
  }
  return {valid: errors.length === 0, errors};
}
function inspectPolicy(policy, errors) {
  const v4 = policy?.schema === 'thinaticsystem/performance-policy/v4' && policy?.version === 'comparative-engineering-v4.0';
  const required = ['schema', 'version', 'anchor', 'caps', 'warmScope', 'materiality', 'schedule', 'calibrationSchedule', 'runtimeMajor', 'absoluteUxAcceptance', ...(v4 ? ['noiseDecision'] : [])];
  if (!shape(policy, required, [], 'policy', errors)) return;
  const v2 = policy.schema === 'thinaticsystem/performance-policy/v2' && policy.version === 'comparative-engineering-v2.0';
  const v3 = policy.schema === 'thinaticsystem/performance-policy/v3' && policy.version === 'comparative-engineering-v3.0';
  requireValue(v2 || v3 || v4, 'policy: unsupported version', errors);
  requireValue(policy.runtimeMajor === 24 && policy.absoluteUxAcceptance === 'NOT_ESTABLISHED', 'policy: unsupported runtime/UX claim', errors);
  if (shape(policy.anchor, ['id', 'proposalSha256', 'reference', 'referenceCodeBytes'], [], 'policy.anchor', errors)) {
    const expected = v4 ? {id: 'source-7a835224-v2', proposalSha256: noiseDecisionSha256, reference: 'candidate-source-7a8352242951516a2380e8fc69c5fb902b0c0e5d', bytes: fixedReferenceV3} : v3 ? {id: 'source-7a835224-v1', proposalSha256: '16a13627d3ef432606d9ddfc982b44e38edae569bcf8d9d526a1cbf101ceca1c', reference: 'candidate-source-7a8352242951516a2380e8fc69c5fb902b0c0e5d', bytes: fixedReferenceV3} : {id: 'required-features-v1', proposalSha256: 'acc9d1071435fba0166d4338aca99021d4e9ba4431a71837e1d659f542edc64f', reference: 'historical-ci-35531884637-baseline', bytes: fixedReferenceV2};
    requireValue(policy.anchor.id === expected.id && policy.anchor.proposalSha256 === expected.proposalSha256 && policy.anchor.reference === expected.reference, 'policy.anchor: immutable reference changed', errors);
    sameRecord(policy.anchor.referenceCodeBytes, expected.bytes, 'policy.anchor.referenceCodeBytes', errors);
  }
  if (shape(policy.caps, ['initial', 'allEmittedJsCssRawBytes', 'warmCodeBytes'], [], 'policy.caps', errors)) {
    sameRecord(policy.caps.initial, initialCaps, 'policy.caps.initial', errors);
    sameRecord(policy.caps.warmCodeBytes, warmCaps, 'policy.caps.warmCodeBytes', errors);
    requireValue(policy.caps.allEmittedJsCssRawBytes === 819_200, 'policy.caps.allEmittedJsCssRawBytes: fixed cap changed', errors);
  }
  sameRecord(policy.materiality, {timingAbsoluteFloorInMs: 50, resourceAbsoluteFloorInBytes: 1024, relativeRatio: 0.2}, 'policy.materiality', errors);
  for (const [key, expected] of [['schedule', schedule], ['calibrationSchedule', calibrationSchedule]]) requireValue(Array.isArray(policy[key]) && policy[key].length === expected.length && expected.every((side, index) => policy[key][index] === side), `policy.${key}: fixed schedule changed`, errors);
  if (shape(policy.warmScope, ['status', 'fixtureSha256', 'harnessSha256', 'reviewReference', 'scope', 'reason'], [], 'policy.warmScope', errors)) {
    const scope = policy.warmScope;
    requireValue(scope.scope === 'decoded-code-action-and-tail' && text(scope.reason), 'policy.warmScope: missing scope/rationale', errors);
    if (scope.status === 'REVIEW_REQUIRED') requireValue(scope.fixtureSha256 === null && scope.harnessSha256 === null && scope.reviewReference === null, 'policy.warmScope: unreviewed binding contradiction', errors);
    else requireValue(scope.status === 'REVIEWED_COMPATIBLE' && hashPattern.test(scope.fixtureSha256) && hashPattern.test(scope.harnessSha256) && text(scope.reviewReference), 'policy.warmScope: missing compatibility approval', errors);
  }
  if (v4) {
    requireValue(Object.keys(policy.noiseDecision).length === noiseDecisionKeys.length && Object.keys(policy.noiseDecision).every((key, index) => key === noiseDecisionKeys[index]), 'policy.noiseDecision: key order changed', errors);
    for (const key of noiseDecisionKeys) requireValue(policy.noiseDecision[key] === noiseDecision[key], `policy.noiseDecision.${key}: proposal changed`, errors);
  }
}
function inspectAssets(assets, errors) {
  if (!shape(assets, ['initial', 'allEmittedJsCssRawBytes', 'baseline'], [], 'assets', errors)) return;
  for (const [label, side] of [['assets', assets], ['assets.baseline', assets.baseline]]) {
    if (label !== 'assets' && !shape(side, ['initial', 'allEmittedJsCssRawBytes'], [], label, errors)) continue;
    if (shape(side.initial, ['rawBytes', 'gzipBytes', 'brotliBytes'], [], `${label}.initial`, errors)) {
      for (const key of Object.keys(initialCaps)) requireValue(integer(side.initial[key]), `${label}.initial.${key}: invalid bytes`, errors);
      requireValue(side.allEmittedJsCssRawBytes >= side.initial.rawBytes, `${label}: initial exceeds all emitted JS/CSS`, errors);
    }
    requireValue(integer(side.allEmittedJsCssRawBytes), `${label}.allEmittedJsCssRawBytes: invalid bytes`, errors);
  }
}
function inspectSeries(series, expected, receiptArray, label, errors, notes) {
  if (!Array.isArray(series) || series.length !== expected.length) { errors.push(`${label}: expected ${expected.length} observations`); return; }
  if (!Array.isArray(receiptArray) || receiptArray.length !== expected.length) errors.push(`receipts.${label}: wrong receipt count`);
  series.forEach((observation, index) => {
    inspectObservation(observation, `${label}[${index}]`, errors, notes);
    if (!record(observation)) return;
    requireValue(observation.side === expected[index] && observation.attemptOrdinal === index, `${label}[${index}]: schedule/ordinal mismatch`, errors);
    const receipt = receiptArray?.[index];
    const path = `receipts.${label}[${index}]`;
    if (!shape(receipt, ['side', 'attemptOrdinal', 'status', 'signal', 'timedOut', 'cleanup', 'stderr', 'runtime'], [], path, errors)) return;
    requireValue(receipt.side === observation.side && receipt.attemptOrdinal === index, `${path}: identity mismatch`, errors);
    requireValue(receipt.status === 0 && receipt.signal === null && receipt.timedOut === false && receipt.cleanup === true && receipt.stderr === '', `${path}: abnormal exit/cleanup/stderr`, errors);
    requireValue(typeof receipt.runtime === 'string' && /^v24\.\d+\.\d+$/.test(receipt.runtime), `${path}.runtime: unsupported or unknown`, errors);
  });
}
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}
function statistics(values) {
  const center = median(values);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return {values: [...values], median: center, minimum, maximum, range: maximum - minimum, mad: median(values.map(value => Math.abs(value - center)))};
}
function pairedComparison(series, extract, floor) {
  const baseline = series.filter(item => item.side === 'baseline').map(extract);
  const candidate = series.filter(item => item.side === 'candidate').map(extract);
  const left = statistics(baseline);
  const right = statistics(candidate);
  const paired = [];
  for (let index = 0; index < series.length; index += 2) {
    const pair = series.slice(index, index + 2);
    paired.push(extract(pair.find(item => item.side === 'candidate')) - extract(pair.find(item => item.side === 'baseline')));
  }
  const pairedDeltas = statistics(paired);
  const threshold = Math.max(floor, left.median * 0.2);
  const blockDeltas = [];
  for (let index = 0; index < paired.length; index += 2) blockDeltas.push(median(paired.slice(index, index + 2)));
  const noisy = left.range > Math.max(floor, left.median * 0.2) || right.range > Math.max(floor, right.median * 0.2) || pairedDeltas.range > threshold;
  const contradictory = blockDeltas.some(delta => delta > threshold) && blockDeltas.some(delta => delta <= threshold);
  return {baseline: left, candidate: right, pairedDeltas, blockDeltas, threshold, medianDelta: right.median - left.median, unstable: noisy || contradictory, materialRegression: pairedDeltas.median > threshold && right.median - left.median > threshold};
}
function pairedComparisonV4(series, extract, floor) {
  const baseline = series.filter(item => item.side === 'baseline').map(extract);
  const candidate = series.filter(item => item.side === 'candidate').map(extract);
  const left = statistics(baseline);
  const right = statistics(candidate);
  const paired = [];
  for (let index = 0; index < series.length; index += 2) {
    const pair = series.slice(index, index + 2);
    paired.push(extract(pair.find(item => item.side === 'candidate')) - extract(pair.find(item => item.side === 'baseline')));
  }
  const pairedDeltas = statistics(paired);
  const threshold = Math.max(floor, left.median * 0.2);
  const blockDeltas = [];
  for (let index = 0; index < paired.length; index += 2) blockDeltas.push(median(paired.slice(index, index + 2)));
  const blockSignals = blockDeltas.map(delta => delta > threshold);
  const blockInconsistent = blockSignals.length === 2 && blockSignals[0] !== blockSignals[1];
  const materialRegression = pairedDeltas.median > threshold && right.median - left.median > threshold;
  const aggregateSignalMismatch = (pairedDeltas.median > threshold) !== (right.median - left.median > threshold);
  const bothBlocksExceedWithoutAggregate = blockSignals.length === 2 && blockSignals.every(Boolean) && !materialRegression;
  return {baseline: left, candidate: right, pairedDeltas, blockDeltas, blockSignals, threshold, medianDelta: right.median - left.median, aggregateSignalMismatch, unstable: blockInconsistent || aggregateSignalMismatch || bothBlocksExceedWithoutAggregate, materialRegression};
}
function journey(observation, id) { return observation.journeys.find(item => item.id === id); }
function elapsedInMs(observation, id) {
  const item = journey(observation, id);
  return item.pageClock ? item.pageClock.endInMs - item.pageClock.startInMs : item.elapsedInMs;
}
function resourceBytes(observation, id, category, scope = null) {
  const resources = journey(observation, id).resources.filter(item => item.category === category && (scope === null || item.scope === scope));
  return resources.some(item => item.decodedBodySizeInBytes === null) ? null : resources.reduce((sum, item) => sum + item.decodedBodySizeInBytes, 0);
}
function baseResult(schema = 'thinaticsystem/performance-evaluation/v3') {
  return {
    schema, verdict: 'INVALID_EVIDENCE', validationErrors: [], sizeChecks: [], timingChecks: [],
    notes: ['Comparative engineering gate only; 50 ms/20% and 1024 B/20% are provisional significance filters, not UX SLOs.', 'Four observations per side do not establish statistical significance, p95, field Web Vitals or provider delivery.', 'Source/build authenticity and receipt provenance are parent-owned; supplied hashes are checked for consistency, not cryptographic origin.'],
    coverage: {required: [...requiredJourneyIds], validated: [], field: 'UNVERIFIED', provider: 'UNVERIFIED', absoluteTimingSlo: 'UNCALIBRATED'},
    absoluteUxAcceptance: 'NOT_ESTABLISHED',
  };
}

/**
 * Evaluate captured raw DTOs without mutating callers. Never trust aggregates.
 * Verdict precedence: INVALID_EVIDENCE > FAIL (fixed cap) > INCONCLUSIVE (A/A or
 * comparison instability) > REVIEW_REQUIRED > PASS_WITH_NOTES. Fixed asset caps
 * remain meaningful even when timing calibration is noisy. No rerun selection.
 */
export function evaluatePerformance(input) {
  try { return evaluateCapturedPerformance(input); }
  catch (error) {
    const result = baseResult();
    result.validationErrors.push(`input: malformed DTO (${error.message})`);
    return result;
  }
}
function evaluateCapturedPerformance(input) {
  const result = baseResult();
  const errors = result.validationErrors;
  let captured;
  try { captured = capture(input); }
  catch (error) { errors.push(`input: ${error.message}`); return result; }
  if (!shape(captured, ['observations', 'calibration', 'assets', 'policy', 'receipts'], [], 'input', errors)) return result;
  const {observations, calibration, assets, policy, receipts} = captured;
  result.schema = policy.schema === 'thinaticsystem/performance-policy/v2' ? 'thinaticsystem/performance-evaluation/v2' : policy.schema === 'thinaticsystem/performance-policy/v4' ? 'thinaticsystem/performance-evaluation/v4' : 'thinaticsystem/performance-evaluation/v3';
  inspectPolicy(policy, errors);
  inspectAssets(assets, errors);
  shape(receipts, ['observations', 'calibration'], [], 'receipts', errors);
  inspectSeries(observations, schedule, receipts?.observations, 'observations', errors, result.notes);
  inspectSeries(calibration, calibrationSchedule, receipts?.calibration, 'calibration', errors, result.notes);
  if (errors.length) return result;
  const all = [...calibration, ...observations];
  const candidate = observations.find(item => item.side === 'candidate');
  for (const id of requiredJourneyIds) {
    const reference = journey(candidate, id);
    for (const [index, item] of all.entries()) {
      const current = journey(item, id);
      requireValue(Object.hasOwn(current, 'pageClock') === Object.hasOwn(reference, 'pageClock') && equalDto(current.readinessWitness, reference.readinessWitness), `identities[${index}].${id}: asymmetric clock/readiness evidence`, errors);
    }
  }
  for (const [index, item] of all.entries()) {
    for (const key of ['fixtureSha256', 'harnessSha256']) requireValue(item[key] === candidate[key], `identities[${index}].${key}: drift`, errors);
    for (const key of ['version', 'executablePath']) requireValue(item.browser[key] === candidate.browser[key], `identities[${index}].browser.${key}: drift`, errors);
  }
  for (const side of ['baseline', 'candidate']) {
    const sideObservations = observations.filter(item => item.side === side);
    requireValue(sideObservations.every(item => item.buildSha256 === sideObservations[0].buildSha256), `${side}: build hash drift`, errors);
  }
  requireValue(calibration.every(item => item.buildSha256 === candidate.buildSha256), 'calibration: not the exact candidate build', errors);
  const runtimes = [...receipts.observations, ...receipts.calibration].map(receipt => receipt.runtime);
  requireValue(runtimes.every(runtime => runtime === runtimes[0]), 'receipts: runtime version drift', errors);
  const compatible = policy.warmScope.status === 'REVIEWED_COMPATIBLE';
  if (compatible) requireValue(policy.warmScope.fixtureSha256 === candidate.fixtureSha256 && policy.warmScope.harnessSha256 === candidate.harnessSha256, 'policy.warmScope: reviewed fixture/harness mismatch', errors);
  if (errors.length) return result;
  result.coverage.validated = [...requiredJourneyIds];
  result.coverage.warmHistoricalScope = compatible ? 'REVIEWED_COMPATIBLE' : 'REVIEW_REQUIRED';
  if (!compatible) result.notes.push(policy.warmScope.reason);
  let capFailure = false;
  let unstable = false;
  let inconclusive = false;
  let materialRegression = false;
  let review = false;
  function capCheck(id, value, cap) {
    const exceeded = value > cap;
    result.sizeChecks.push({kind: 'fixed-cap', id, value, cap, status: exceeded ? 'EXCEEDED' : 'WITHIN_CAP'});
    capFailure ||= exceeded;
  }
  for (const key of Object.keys(initialCaps)) capCheck(`initial.${key}`, assets.initial[key], initialCaps[key]);
  capCheck('allEmittedJsCssRawBytes', assets.allEmittedJsCssRawBytes, 819_200);
  for (const key of [...Object.keys(initialCaps), 'allEmittedJsCssRawBytes']) {
    const initial = key !== 'allEmittedJsCssRawBytes';
    const baseline = initial ? assets.baseline.initial[key] : assets.baseline[key];
    const candidate = initial ? assets.initial[key] : assets[key];
    const delta = candidate - baseline, threshold = Math.max(1024, baseline * 0.2);
    const material = delta > threshold;
    result.sizeChecks.push({kind:'static-comparison', id:initial ? `initial.${key}` : key, baseline, candidate, delta, threshold, status:material ? 'MATERIAL_REGRESSION' : delta > 0 ? 'SMALL_INCREASE_NOTE' : 'WITHIN_FILTER'});
    review ||= material;
  }
  const isV4 = policy.schema === 'thinaticsystem/performance-policy/v4';
  for (const id of requiredJourneyIds) {
    const aa = isV4 ? pairedComparisonV4(calibration, item => elapsedInMs(item, id), 50) : pairedComparison(calibration, item => elapsedInMs(item, id), 50);
    const comparison = isV4 ? pairedComparisonV4(observations, item => elapsedInMs(item, id), 50) : pairedComparison(observations, item => elapsedInMs(item, id), 50);
    const calibrationStable = isV4
      ? Math.abs(aa.pairedDeltas.median) <= aa.threshold && Math.abs(aa.medianDelta) <= aa.threshold
      : !aa.unstable && Math.abs(aa.pairedDeltas.median) <= aa.threshold && Math.abs(aa.medianDelta) <= aa.threshold;
    if (isV4) {
      inconclusive ||= !calibrationStable || comparison.unstable;
      materialRegression ||= comparison.materialRegression;
    } else {
      unstable ||= !calibrationStable || comparison.unstable;
    }
    review ||= comparison.materialRegression;
    const status = comparison.materialRegression ? 'MATERIAL_REGRESSION' : !calibrationStable || comparison.unstable ? 'INCONCLUSIVE' : 'WITHIN_FILTER';
    result.timingChecks.push({id, unit: 'ms', calibration: {...aa, stable: calibrationStable}, comparison, status});
    for (const category of categories) for (const scope of [null, ...scopes]) {
      const extract = item => resourceBytes(item, id, category, scope);
      if (all.some(item => extract(item) === null)) {
        result.sizeChecks.push({kind: 'resource-comparison', id, category, scope, status: 'UNKNOWN'});
        continue;
      }
      const resourceAa = isV4 ? pairedComparisonV4(calibration, extract, 1024) : pairedComparison(calibration, extract, 1024);
      const resourceComparison = isV4 ? pairedComparisonV4(observations, extract, 1024) : pairedComparison(observations, extract, 1024);
      const stable = isV4
        ? Math.abs(resourceAa.pairedDeltas.median) <= resourceAa.threshold && Math.abs(resourceAa.medianDelta) <= resourceAa.threshold
        : !resourceAa.unstable && Math.abs(resourceAa.pairedDeltas.median) <= resourceAa.threshold && Math.abs(resourceAa.medianDelta) <= resourceAa.threshold;
      if (isV4) {
        inconclusive ||= !stable || resourceComparison.unstable;
        materialRegression ||= resourceComparison.materialRegression;
      } else {
        unstable ||= !stable || resourceComparison.unstable;
      }
      review ||= resourceComparison.materialRegression;
      const resourceStatus = resourceComparison.materialRegression ? 'MATERIAL_REGRESSION' : !stable || resourceComparison.unstable ? 'INCONCLUSIVE' : 'WITHIN_FILTER';
      result.sizeChecks.push({kind: 'resource-comparison', id, category, scope, unit: 'decoded-bytes', calibration: {...resourceAa, stable}, comparison: resourceComparison, status: resourceStatus});
    }
    if (Object.hasOwn(warmCaps, id)) {
      const candidateBytes = observations.filter(item => item.side === 'candidate').map(item => resourceBytes(item, id, 'code'));
      const maximum = Math.max(...candidateBytes);
      const reference = (policy.schema === 'thinaticsystem/performance-policy/v2' ? fixedReferenceV2 : fixedReferenceV3)[id];
      const delta = median(candidateBytes) - reference;
      const threshold = Math.max(1024, reference * 0.2);
      result.sizeChecks.push({kind: 'fixed-warm-anchor', id, candidateBytes, reference, cap: warmCaps[id], delta, threshold, status: compatible ? maximum > warmCaps[id] ? 'EXCEEDED' : delta > threshold ? 'MATERIAL_REGRESSION' : 'WITHIN_CAP' : 'SCOPE_REVIEW_REQUIRED'});
      if (compatible) { capFailure ||= maximum > warmCaps[id]; review ||= delta > threshold; }
    }
    result.sizeChecks.push({kind: 'request-count-diagnostic', id, baseline: observations.filter(item => item.side === 'baseline').map(item => journey(item, id).requestCount), candidate: observations.filter(item => item.side === 'candidate').map(item => journey(item, id).requestCount), status: 'DIAGNOSTIC_ONLY'});
  }
  result.verdict = isV4
    ? capFailure ? 'FAIL' : materialRegression ? 'REVIEW_REQUIRED' : inconclusive ? 'INCONCLUSIVE' : review ? 'REVIEW_REQUIRED' : 'PASS_WITH_NOTES'
    : capFailure ? 'FAIL' : unstable ? 'INCONCLUSIVE' : review ? 'REVIEW_REQUIRED' : 'PASS_WITH_NOTES';
  return result;
}
