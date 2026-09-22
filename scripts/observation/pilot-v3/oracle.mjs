import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const BASE_COMMIT = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';
export const REPO_ROOT = '/home/ts/site-development/thinaticsystem-renovate-20260921';
const rel = file => file.startsWith(`${REPO_ROOT}/`) ? file.slice(REPO_ROOT.length + 1) : file;
const sha = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

export const PILOT_CASES = [
  {key: 'app-create', runner: 'angular', oldFullId: 'AppComponent should create the app', baseFile: 'src/app/app.component.spec.ts', finalFile: 'src/app/app.component.spec.ts', finalFullId: 'AppComponent Given the application shell is rendered When the component is created Then it exposes an application instance', assertionWitnesses: ['fixture.componentInstance', 'toBeTruthy'], boundary: 'basic application creation'},
  {key: 'app-controls', runner: 'angular', oldFullId: 'AppComponent should expose semantic shell controls', baseFile: 'src/app/app.component.spec.ts', finalFile: 'src/app/app.component.spec.ts', finalFullId: 'AppComponent Given the application shell is rendered When a user toggles theme and menu controls Then semantic state and navigation are exposed', assertionWitnesses: ['aria-pressed', 'aria-expanded', 'モバイルナビゲーション'], boundary: 'semantic control state transition'},
  {key: 'notification-create', runner: 'angular', oldFullId: 'NotificationService should be created', baseFile: 'src/app/services/notification.service.spec.ts', finalFile: 'src/app/services/notification.service.spec.ts', finalFullId: 'NotificationService Given the service is injected When the service is created Then it is available', assertionWitnesses: ['expect(service).toBeTruthy'], boundary: 'basic service construction'},
  {key: 'notification-replacement', runner: 'angular', oldFullId: 'NotificationService lifetime [notification-replacement-lifetime] gives each replacement its full three seconds', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification.service.regression.spec.ts', finalFullId: 'NotificationService regression witnesses Given a timer-backed service When a replacement arrives near expiry Then each message gets a full three seconds', classification: 'concrete-regression', assertionWitnesses: ['2_999', '2_998', 'getTimerCount'], boundary: 'replacement timer lifetime'},
  {key: 'notification-default', runner: 'angular', oldFullId: 'NotificationService lifetime repeated replacements keep one timer and preserve the default message', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification-lifetime.spec.ts', finalFullId: 'NotificationService Given a fresh service with fake timers When blank and omitted messages replace content Then one timer and the default message remain', assertionWitnesses: ['コピーしました！', 'getTimerCount', '3_000'], boundary: 'blank and omitted message inputs'},
  {key: 'notification-destroy', runner: 'angular', oldFullId: 'NotificationService lifetime releases its timer when the injector destroys the service', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification-lifetime.spec.ts', finalFullId: 'NotificationService Given a fresh service with fake timers When the injector destroys the service Then its timer is released', assertionWitnesses: ['resetTestingModule', 'getTimerCount', 'showNotification'], boundary: 'injector-owned timer cleanup'},
  {key: 'recorder-begin', runner: 'node-tap', oldFullId: 'begin owns in-flight requests before a terminal callback exists', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given a new ledger, when a request begins before its terminal callback, then the request remains owned with unknown bytes', assertionWitnesses: ['context-1', 'decodedBodySizeInBytes: null', 'pending'], boundary: 'in-flight request with no terminal callback'},
  {key: 'recorder-drain', runner: 'node-tap', oldFullId: 'child begun during drain stays owned and has explicit tail scope', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given a parent request and a child request, when the parent finishes during drain, then the child stays in the tail scope', assertionWitnesses: ['/parent', '/child', "'tail'"], boundary: 'child request during drain'},
  {key: 'recorder-invalid', runner: 'node-tap', oldFullId: 'unknown bytes are null, failures remain failures, illegal terminals reject', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given an image request with unknown bytes, when it fails, then failure and invalid terminal transitions remain explicit', assertionWitnesses: ["'failed'", 'Duplicate', 'without request begin'], boundary: 'failed terminal and invalid transition matrix'},
  {key: 'recorder-clock', runner: 'node-tap', oldFullId: 'page clock reset cannot erase request IDs or preceding owner records', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given requests recorded across owners, when the page clock resets, then IDs and preceding owner records remain addressable', assertionWitnesses: ['context-3:1', 'context-3:2', 'startInMs'], boundary: 'page clock reset and owner history'},
  {key: 'recorder-fixture-reject', runner: 'node-tap', oldFullId: 'CMS fixtures reject unknown host, path, query and method', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given the CMS fixture table, when an unknown host path query or method is requested, then no fixture is returned', assertionWitnesses: ['anything=1', "'POST'", 'fixtureFor'], boundary: 'unknown CMS host/path/query/method'},
  {key: 'recorder-fixture-detail', runner: 'node-tap', oldFullId: 'detail fixture matches actual CMS arrays and rich markdown exercises overrides', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given the detail and article fixtures, when CMS arrays and rich markdown are consumed, then all overrides remain visible', assertionWitnesses: ['Fixture composer', 'performance-artwork.svg', 'Formatted fixture'], boundary: 'detail arrays and rich markdown overrides'},
];

export function sourceText(file, root = REPO_ROOT) {
  const path = resolve(root, file);
  if (!existsSync(path)) throw new Error(`source file does not exist: ${file}`);
  return readFileSync(path, 'utf8');
}

export function sourceTextAtCommit(file, commit = BASE_COMMIT) {
  return execFileSync('git', ['show', `${commit}:${file}`], {cwd: REPO_ROOT, encoding: 'utf8'});
}

function locateCaseInText(text, file, title) {
  const lines = text.split('\n');
  const candidates = [title, title.replace(/^.*?\b(?=should\b|\[)/, ''), title.replace(/^.*?\s(?=gives\b|repeated\b|releases\b)/, '')];
  let start = -1;
  for (const candidate of candidates) {
    start = lines.findIndex(line => line.includes(candidate));
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`case title is not present in ${file}: ${title}`);
  let end = start;
  while (end + 1 < lines.length && !/^\s*\}\);\s*$/.test(lines[end])) end += 1;
  return {file, startLine: start + 1, endLine: end + 1};
}

export function locateCaseInFile(file, title, root = REPO_ROOT) {
  return locateCaseInText(sourceText(file, root), file, title);
}

export function stableKey(caseDef, oldEntryIndex) {
  return `${caseDef.runner}:${oldEntryIndex}:${sha(caseDef.oldFullId)}`;
}

const manualRecorder = {
  'begin owns in-flight requests before a terminal callback exists': {input: {contextId: 'context-1', url: 'https://example.test/a.js', category: 'code', owner: 'journey', startInMs: 10}, expected: 'pending=1;terminal=unknown;decodedBodySizeInBytes=null', assertion: 'deepEqual snapshot plus pending count'},
  'child begun during drain stays owned and has explicit tail scope': {input: {parent: '/parent', child: '/child', terminalBytes: [12, 8]}, expected: 'action/finished/12 and tail/finished/8', assertion: 'deepEqual scope/terminal/bytes rows'},
  'unknown bytes are null, failures remain failures, illegal terminals reject': {input: {url: '/x', terminal: 'failed'}, expected: 'failed terminal plus three throws', assertion: 'null bytes, failed status, duplicate/missing-begin errors'},
  'page clock reset cannot erase request IDs or preceding owner records': {input: {contextId: 'context-3', owners: ['cold', 'next']}, expected: 'context-3:1 and context-3:2', assertion: 'owner snapshots retain IDs'},
  'CMS fixtures reject unknown host, path, query and method': {input: {unknownHosts: ['player.example.test'], method: 'POST'}, expected: 'null for each rejected fixture', assertion: 'fixtureFor returns null'},
  'detail fixture matches actual CMS arrays and rich markdown exercises overrides': {input: {releaseId: 1, markdown: ['bold', 'link', 'image']}, expected: 'release arrays and markdown overrides', assertion: 'deepEqual/match/assertion set'},
};

export function buildBeforeEvidence(observationMap, baseTap) {
  const entries = observationMap.entries ?? [];
  const tapOrdinals = new Map();
  for (const line of baseTap.split('\n')) {
    const match = line.match(/^(?:ok|not ok) (\d+) - (.+)$/);
    if (match && !tapOrdinals.has(match[2])) tapOrdinals.set(match[2], Number(match[1]));
  }
  return PILOT_CASES.map(caseDef => {
    const old = entries.find((entry, index) => entry.oldFullTestId === caseDef.oldFullId && (caseDef.runner === 'angular' ? entry.runner === 'angular' : entry.runner === 'node-tap'));
    const runnerOrdinal = caseDef.runner === 'node-tap' ? tapOrdinals.get(caseDef.oldFullId) : null;
    const oldEntryIndex = old ? entries.indexOf(old) : runnerOrdinal;
    if (!Number.isInteger(oldEntryIndex)) throw new Error(`old observation index missing: ${caseDef.oldFullId}`);
    const sourceLocation = locateCaseInText(sourceTextAtCommit(caseDef.baseFile), caseDef.baseFile, caseDef.oldFullId);
    const manual = manualRecorder[caseDef.oldFullId];
    return {
      oldEntryIndex,
      indexBasis: old ? 'observation-map-before.entries zero-based index' : 'node-tests-before.tap one-based subtest ordinal',
      stableKey: stableKey(caseDef, oldEntryIndex),
      runner: caseDef.runner,
      oldFullId: caseDef.oldFullId,
      baseCommit: BASE_COMMIT,
      baseFile: caseDef.baseFile,
      baseSourceRange: sourceLocation,
      meaningfulInput: old?.scenarioSignificantInput ?? manual.input,
      expectedResult: old?.expectedResult ?? 'passed',
      originalRunnerAssertion: old?.importantAssertion ?? null,
      normalizedAssertion: {signature: caseDef.assertionWitnesses.join(';'), matcherWitnesses: caseDef.assertionWitnesses},
      assertionWitnesses: caseDef.assertionWitnesses,
      errorBoundary: [...(old?.boundaryObservation ?? []), caseDef.boundary],
      classification: caseDef.classification ?? 'normative-specification',
    };
  });
}

export function buildPlan(before) {
  return before.map(entry => {
    const caseDef = PILOT_CASES.find(item => item.oldFullId === entry.oldFullId);
    return {oldEntryIndex: entry.oldEntryIndex, oldStableKey: entry.stableKey, oldFullId: entry.oldFullId, classification: entry.classification, plannedFinalCases: [{file: caseDef.finalFile, fullId: caseDef.finalFullId}]};
  });
}

export function parseAngularReport(report, command) {
  const events = [];
  for (const fileResult of report.testResults ?? []) {
    for (const assertion of fileResult.assertionResults ?? []) {
      events.push({eventId: `angular:${assertion.fullName}`, runner: 'angular', fullId: assertion.fullName, file: rel(fileResult.name), status: assertion.status === 'passed' ? 'PASS' : 'FAIL', title: assertion.title, sourceRange: locateCaseInFile(rel(fileResult.name), assertion.title), command, commandExit: report.success ? 0 : 1});
    }
  }
  return events;
}

export function parseNodeTap(tap, command, file = 'scripts/performance/recorder.spec.test.mjs', commandExit = 0) {
  const events = [];
  for (const line of tap.split('\n')) {
    const match = line.match(/^(ok|not ok) (\d+) - (.+)$/);
    if (!match) continue;
    const title = match[3];
    events.push({eventId: `node-tap:${match[2]}:${title}`, runner: 'node-tap', fullId: title, file, status: match[1] === 'ok' ? 'PASS' : 'FAIL', title, sourceRange: locateCaseInFile(file, title), command, commandExit});
  }
  return events;
}

export function buildAfterEvidence(before, plan, events) {
  return before.map(entry => {
    const planned = plan.find(item => item.oldStableKey === entry.stableKey);
    const final = planned?.plannedFinalCases?.[0];
    const event = events.find(item => item.fullId === final?.fullId && item.file === final.file);
    const caseDef = PILOT_CASES.find(item => item.oldFullId === entry.oldFullId);
    if (!event) throw new Error(`actual runner event missing: ${final?.fullId}`);
    return {oldEntryIndex: entry.oldEntryIndex, oldStableKey: entry.stableKey, oldFullId: entry.oldFullId, classification: entry.classification, finalFile: final.file, finalFullId: final.fullId, finalSourceRange: event.sourceRange, assertionSignature: caseDef.assertionWitnesses.join(';'), assertionWitnesses: caseDef.assertionWitnesses, errorBoundary: entry.errorBoundary, status: event.status, runnerEvidence: {eventId: event.eventId, runner: event.runner, command: event.command, commandExit: event.commandExit, fullId: event.fullId, file: event.file, status: event.status, sourceRange: event.sourceRange}};
  });
}

export function verifyEvidence({before, plan, after, events, sourceRoot = REPO_ROOT, commandExits = []}) {
  if (before.length !== 12 || plan.length !== 12 || after.length !== 12) throw new Error('pilot evidence must contain exactly 12 old observations');
  for (const item of before) if (!item.baseSourceRange || item.baseSourceRange.startLine <= 1 || item.baseSourceRange.endLine < item.baseSourceRange.startLine) throw new Error(`invalid base source range: ${item.oldFullId}`);
  const stableKeys = before.map(item => item.stableKey);
  if (new Set(stableKeys).size !== stableKeys.length) throw new Error('duplicate stable key');
  if (new Set(after.map(item => item.finalFullId)).size !== after.length) throw new Error('duplicate final full ID');
  if (new Set(events.map(item => item.eventId)).size !== events.length) throw new Error('duplicate runner event ID');
  if (commandExits.some(item => item.exitCode !== 0)) throw new Error('whole-command exit is nonzero');
  for (const item of after) {
    if (!item.runnerEvidence?.eventId || /passed-or-reconciled/i.test(JSON.stringify(item))) throw new Error('missing actual runner evidence');
    const matches = events.filter(candidate => candidate.eventId === item.runnerEvidence.eventId);
    if (matches.length !== 1) throw new Error(`runner event is missing or ambiguous: ${item.oldFullId}`);
    const event = matches[0];
    if (event.fullId !== item.finalFullId || event.file !== item.finalFile || event.status !== 'PASS' || event.commandExit !== 0) throw new Error(`runner event is missing, ambiguous, failed, or forged: ${item.oldFullId}`);
    if (item.status !== 'PASS') throw new Error(`after status is not PASS: ${item.oldFullId}`);
    if (!item.finalSourceRange || item.finalSourceRange.startLine <= 1 || item.finalSourceRange.endLine < item.finalSourceRange.startLine) throw new Error(`invalid final source range: ${item.oldFullId}`);
    const text = sourceText(item.finalFile, sourceRoot);
    for (const witness of item.assertionWitnesses ?? []) if (!text.includes(witness)) throw new Error(`dropped assertion witness ${witness}: ${item.oldFullId}`);
    if (!item.assertionSignature || item.assertionSignature.split(';').some(token => !(item.assertionWitnesses ?? []).includes(token))) throw new Error(`dropped matcher signature: ${item.oldFullId}`);
  }
  return {oldRows: before.length, reconciled: after.length, statuses: Object.groupBy(after, item => item.status), explicitOneToMany: after.filter(item => Array.isArray(item.finalFullIds) && item.finalFullIds.length > 1).length};
}
