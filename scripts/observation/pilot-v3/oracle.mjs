import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

export const BASE_COMMIT = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';
export const REPO_ROOT = '/home/ts/site-development/thinaticsystem-renovate-20260921';
const rel = file => file.startsWith(`${REPO_ROOT}/`) ? file.slice(REPO_ROOT.length + 1) : file;
const sha = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

// Mapping metadata identifies the bounded pilot rows; source ranges and assertion signatures are always parsed from source.
export const PILOT_CASES = [
  {key: 'app-create', runner: 'angular', oldFullId: 'AppComponent should create the app', baseFile: 'src/app/app.component.spec.ts', finalFile: 'src/app/app.component.spec.ts', finalFullId: 'AppComponent Given the application shell is rendered When the component is created Then it exposes an application instance', baseTitle: 'should create the app'},
  {key: 'app-controls', runner: 'angular', oldFullId: 'AppComponent should expose semantic shell controls', baseFile: 'src/app/app.component.spec.ts', finalFile: 'src/app/app.component.spec.ts', finalFullId: 'AppComponent Given the application shell is rendered When a user toggles theme and menu controls Then semantic state and navigation are exposed', baseTitle: 'should expose semantic shell controls'},
  {key: 'notification-create', runner: 'angular', oldFullId: 'NotificationService should be created', baseFile: 'src/app/services/notification.service.spec.ts', finalFile: 'src/app/services/notification.service.spec.ts', finalFullId: 'NotificationService Given the service is injected When the service is created Then it is available', baseTitle: 'should be created'},
  {key: 'notification-replacement', runner: 'angular', oldFullId: 'NotificationService lifetime [notification-replacement-lifetime] gives each replacement its full three seconds', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification.service.regression.spec.ts', finalFullId: 'NotificationService regression witnesses Given a timer-backed service When a replacement arrives near expiry Then each message gets a full three seconds', baseTitle: '[notification-replacement-lifetime] gives each replacement its full three seconds', classification: 'concrete-regression'},
  {key: 'notification-default', runner: 'angular', oldFullId: 'NotificationService lifetime repeated replacements keep one timer and preserve the default message', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification-lifetime.spec.ts', finalFullId: 'NotificationService Given a fresh service with fake timers When blank and omitted messages replace content Then one timer and the default message remain', baseTitle: 'repeated replacements keep one timer and preserve the default message'},
  {key: 'notification-destroy', runner: 'angular', oldFullId: 'NotificationService lifetime releases its timer when the injector destroys the service', baseFile: 'src/app/services/notification-lifetime.spec.ts', finalFile: 'src/app/services/notification-lifetime.spec.ts', finalFullId: 'NotificationService Given a fresh service with fake timers When the injector destroys the service Then its timer is released', baseTitle: 'releases its timer when the injector destroys the service'},
  {key: 'recorder-begin', runner: 'node-tap', oldFullId: 'begin owns in-flight requests before a terminal callback exists', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given a new ledger, when a request begins before its terminal callback, then the request remains owned with unknown bytes', baseTitle: 'begin owns in-flight requests before a terminal callback exists'},
  {key: 'recorder-drain', runner: 'node-tap', oldFullId: 'child begun during drain stays owned and has explicit tail scope', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given a parent request and a child request, when the parent finishes during drain, then the child stays in the tail scope', baseTitle: 'child begun during drain stays owned and has explicit tail scope'},
  {key: 'recorder-invalid', runner: 'node-tap', oldFullId: 'unknown bytes are null, failures remain failures, illegal terminals reject', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given an image request with unknown bytes, when it fails, then failure and invalid terminal transitions remain explicit', baseTitle: 'unknown bytes are null, failures remain failures, illegal terminals reject'},
  {key: 'recorder-clock', runner: 'node-tap', oldFullId: 'page clock reset cannot erase request IDs or preceding owner records', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given requests recorded across owners, when the page clock resets, then IDs and preceding owner records remain addressable', baseTitle: 'page clock reset cannot erase request IDs or preceding owner records'},
  {key: 'recorder-fixture-reject', runner: 'node-tap', oldFullId: 'CMS fixtures reject unknown host, path, query and method', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given the CMS fixture table, when an unknown host path query or method is requested, then no fixture is returned', baseTitle: 'CMS fixtures reject unknown host, path, query and method'},
  {key: 'recorder-fixture-detail', runner: 'node-tap', oldFullId: 'detail fixture matches actual CMS arrays and rich markdown exercises overrides', baseFile: 'scripts/performance/recorder.test.mjs', finalFile: 'scripts/performance/recorder.spec.test.mjs', finalFullId: 'Given the detail and article fixtures, when CMS arrays and rich markdown are consumed, then all overrides remain visible', baseTitle: 'detail fixture matches actual CMS arrays and rich markdown exercises overrides'},
];

export function sourceText(file, root = REPO_ROOT) {
  const path = resolve(root, file);
  if (!existsSync(path)) throw new Error(`source file does not exist: ${file}`);
  return readFileSync(path, 'utf8');
}
export function sourceTextAtCommit(file, commit = BASE_COMMIT) {
  return execFileSync('git', ['show', `${commit}:${file}`], {cwd: REPO_ROOT, encoding: 'utf8'});
}

function scriptKind(file) { return file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS; }
function parseSource(text, file) { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file)); }
function literalText(node) { return ts.isStringLiteralLike(node) ? node.text : null; }
function registrationTitleCandidates(title) {
  return [title, title.replace(/^.*?\b(?:Given|When)\s+/, match => match.trimStart()), title.replace(/^.*?\b(?:should|gives|repeated|releases|begin|child|unknown|page|CMS|detail)\s+/, match => match.trimStart())];
}
function isRegistration(node) { return ts.isIdentifier(node.expression) && (node.expression.text === 'it' || node.expression.text === 'test') && node.arguments.length >= 2 && literalText(node.arguments[0]) !== null && (ts.isArrowFunction(node.arguments[1]) || ts.isFunctionExpression(node.arguments[1])); }
function allRegistrations(sourceFile) {
  const result = [];
  const visit = node => { if (ts.isCallExpression(node) && isRegistration(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(sourceFile); return result;
}
function rangeOf(sourceFile, node, file) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.end);
  return {file, startLine: start.line + 1, endLine: end.line + 1, startOffset: node.getStart(sourceFile), endOffset: node.end, registration: sourceFile.text.slice(node.expression.getStart(sourceFile), node.expression.end)};
}
function findRegistration(text, file, title) {
  const sourceFile = parseSource(text, file);
  const candidates = registrationTitleCandidates(title);
  const registration = allRegistrations(sourceFile).find(node => candidates.includes(literalText(node.arguments[0])) || candidates.some(candidate => literalText(node.arguments[0]) === candidate));
  if (!registration) throw new Error(`registered case is not present in ${file}: ${title}`);
  return {sourceFile, registration, range: rangeOf(sourceFile, registration, file), title: literalText(registration.arguments[0])};
}
export function locateCaseInText(text, file, title) { return findRegistration(text, file, title).range; }
export function locateCaseInFile(file, title, root = REPO_ROOT) { return locateCaseInText(sourceText(file, root), file, title); }

function normalizedText(sourceFile, node) { return sourceFile.text.slice(node.getStart(sourceFile), node.end).replace(/\s+/g, ' ').trim(); }
function signatureForCall(sourceFile, node) {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const method = node.expression.name.text;
  let receiver = node.expression.expression;
  let negated = false;
  if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'not') { negated = true; receiver = receiver.expression; }
  if (ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression) && receiver.expression.text === 'expect') {
    return {operator: 'expect', callKind: 'matcher', negated, matcher: method, operands: receiver.arguments.map(argument => normalizedText(sourceFile, argument)), arguments: node.arguments.map(argument => normalizedText(sourceFile, argument)), source: rangeOf(sourceFile, node, sourceFile.fileName)};
  }
  if (ts.isIdentifier(receiver) && receiver.text === 'assert') {
    return {operator: 'assert', callKind: method, negated: false, matcher: method, operands: node.arguments.map(argument => normalizedText(sourceFile, argument)), arguments: node.arguments.map(argument => normalizedText(sourceFile, argument)), source: rangeOf(sourceFile, node, sourceFile.fileName)};
  }
  return null;
}
function extractAssertionSignatures(sourceFile, registration) {
  const signatures = [];
  const visit = node => { if (ts.isCallExpression(node)) { const signature = signatureForCall(sourceFile, node); if (signature) signatures.push(signature); } ts.forEachChild(node, visit); };
  visit(registration.arguments[1]);
  return signatures.sort((left, right) => left.source.startOffset - right.source.startOffset);
}
function caseEvidence(text, file, title) {
  const found = findRegistration(text, file, title);
  return {sourceRange: found.range, title: found.title, assertions: extractAssertionSignatures(found.sourceFile, found.registration)};
}

export function stableKey(caseDef, oldEntryIndex) { return `${caseDef.runner}:${oldEntryIndex}:${sha(caseDef.oldFullId)}`; }
const manualInputs = {
  'begin owns in-flight requests before a terminal callback exists': {contextId: 'context-1', url: 'https://example.test/a.js', category: 'code', owner: 'journey', startInMs: 10},
  'child begun during drain stays owned with explicit tail scope': {parent: '/parent', child: '/child', terminalBytes: [12, 8]},
  'unknown bytes are null, failures remain failures, illegal terminals reject': {url: '/x', terminal: 'failed'},
  'page clock reset cannot erase request IDs or preceding owner records': {contextId: 'context-3', owners: ['cold', 'next']},
  'CMS fixtures reject unknown host, path, query and method': {unknownHosts: ['player.example.test'], method: 'POST'},
  'detail fixture matches actual CMS arrays and rich markdown exercises overrides': {releaseId: 1, markdown: ['bold', 'link', 'image']},
};
function sameAssertionSemantics(base, final) { return JSON.stringify(base.map(({source, ...item}) => item)) === JSON.stringify(final.map(({source, ...item}) => item)); }

export function buildBeforeEvidence(observationMap, baseTap) {
  const entries = observationMap.entries ?? [];
  const tapOrdinals = new Map();
  for (const line of baseTap.split('\n')) { const match = line.match(/^(?:ok|not ok) (\d+) - (.+)$/); if (match && !tapOrdinals.has(match[2])) tapOrdinals.set(match[2], Number(match[1])); }
  return PILOT_CASES.map(caseDef => {
    const old = entries.find(entry => entry.oldFullTestId === caseDef.oldFullId && (caseDef.runner === 'angular' ? entry.runner === 'angular' : entry.runner === 'node-tap'));
    const oldEntryIndex = old ? entries.indexOf(old) : tapOrdinals.get(caseDef.oldFullId);
    if (!Number.isInteger(oldEntryIndex)) throw new Error(`old observation index missing: ${caseDef.oldFullId}`);
    const evidence = caseEvidence(sourceTextAtCommit(caseDef.baseFile), caseDef.baseFile, caseDef.baseTitle);
    return {oldEntryIndex, indexBasis: old ? 'observation-map-before.entries zero-based index' : 'node-tests-before.tap one-based subtest ordinal', stableKey: stableKey(caseDef, oldEntryIndex), runner: caseDef.runner, oldFullId: caseDef.oldFullId, baseCommit: BASE_COMMIT, baseFile: caseDef.baseFile, baseSourceRange: evidence.sourceRange, baseCaseTitle: evidence.title, meaningfulInput: old?.scenarioSignificantInput ?? manualInputs[caseDef.oldFullId] ?? null, expectedResult: old?.expectedResult ?? 'passed', originalRunnerAssertion: old?.importantAssertion ?? null, normalizedAssertions: evidence.assertions, errorBoundary: [...(old?.boundaryObservation ?? []), caseDef.classification === 'concrete-regression' ? 'concrete-regression' : 'bounded pilot case'], classification: caseDef.classification ?? 'normative-specification'};
  });
}
export function buildPlan(before) { return before.map(entry => { const caseDef = PILOT_CASES.find(item => item.oldFullId === entry.oldFullId); return {oldEntryIndex: entry.oldEntryIndex, oldStableKey: entry.stableKey, oldFullId: entry.oldFullId, classification: entry.classification, plannedFinalCases: [{file: caseDef.finalFile, fullId: caseDef.finalFullId}]}; }); }

export function parseAngularReport(report, command) {
  const events = [];
  for (const fileResult of report.testResults ?? []) for (const assertion of fileResult.assertionResults ?? []) { const file = rel(fileResult.name); const evidence = caseEvidence(sourceText(file), file, assertion.title); events.push({eventId: `angular:${assertion.fullName}`, runner: 'angular', fullId: assertion.fullName, file, status: assertion.status === 'passed' ? 'PASS' : 'FAIL', title: evidence.title, sourceRange: evidence.sourceRange, assertions: evidence.assertions, command, commandExit: report.success ? 0 : 1}); }
  return events;
}
export function parseNodeTap(tap, command, file = 'scripts/performance/recorder.spec.test.mjs', commandExit = 0) {
  const events = [];
  for (const line of tap.split('\n')) { const match = line.match(/^(ok|not ok) (\d+) - (.+)$/); if (!match) continue; const title = match[3]; const evidence = caseEvidence(sourceText(file), file, title); events.push({eventId: `node-tap:${match[2]}:${title}`, runner: 'node-tap', fullId: title, file, status: match[1] === 'ok' ? 'PASS' : 'FAIL', title: evidence.title, sourceRange: evidence.sourceRange, assertions: evidence.assertions, command, commandExit}); }
  return events;
}
export function buildAfterEvidence(before, plan, events) {
  return before.map(entry => {
    const planned = plan.find(item => item.oldStableKey === entry.stableKey); const final = planned?.plannedFinalCases?.[0]; const matches = events.filter(item => item.runner === entry.runner && item.fullId === final?.fullId && item.file === final.file); if (matches.length !== 1) throw new Error(`actual runner event is missing or ambiguous: ${final?.fullId}`); const event = matches[0];
    return {oldEntryIndex: entry.oldEntryIndex, oldStableKey: entry.stableKey, oldFullId: entry.oldFullId, classification: entry.classification, finalFile: final.file, finalFullId: final.fullId, finalSourceRange: event.sourceRange, finalCaseTitle: event.title, baseAssertions: entry.normalizedAssertions, finalAssertions: event.assertions, assertionSemantics: sameAssertionSemantics(entry.normalizedAssertions, event.assertions) ? 'SUPPORTED_EQUAL' : 'UNKNOWN/manual independent review required', errorBoundary: entry.errorBoundary, status: event.status, runnerEvidence: {eventId: event.eventId, runner: event.runner, command: event.command, commandExit: event.commandExit, fullId: event.fullId, file: event.file, title: event.title, status: event.status, sourceRange: event.sourceRange, assertions: event.assertions}};
  });
}
function identityOf(event) { return `${event.runner}\u0000${event.file}\u0000${event.fullId}`; }
function rangesEqual(left, right) { return left?.file === right?.file && left?.startLine === right?.startLine && left?.endLine === right?.endLine && left?.startOffset === right?.startOffset && left?.endOffset === right?.endOffset; }
export function verifyEvidence({before, plan, after, events, sourceRoot = REPO_ROOT, commandExits = []}) {
  if (before.length !== 12 || plan.length !== 12 || after.length !== 12) throw new Error('pilot evidence must contain exactly 12 old observations');
  if (new Set(before.map(item => item.stableKey)).size !== before.length) throw new Error('duplicate stable key');
  if (new Set(after.map(item => item.finalFullId)).size !== after.length) throw new Error('duplicate final full ID');
  const identities = new Map(); for (const event of events) identities.set(identityOf(event), (identities.get(identityOf(event)) ?? 0) + 1); if ([...identities.values()].some(count => count !== 1)) throw new Error('runner identity is missing or duplicated');
  if (new Set(events.map(item => item.eventId)).size !== events.length) throw new Error('duplicate runner event ID');
  if (commandExits.some(item => item.exitCode !== 0)) throw new Error('whole-command exit is nonzero');
  for (const item of after) {
    if (!item.runnerEvidence?.eventId || /passed-or-reconciled/i.test(JSON.stringify(item))) throw new Error('missing actual runner evidence');
    const matches = events.filter(candidate => candidate.eventId === item.runnerEvidence.eventId); if (matches.length !== 1) throw new Error(`runner event is missing or ambiguous: ${item.oldFullId}`); const event = matches[0];
    if (event.runner !== item.runnerEvidence.runner || event.fullId !== item.finalFullId || event.file !== item.finalFile || event.status !== 'PASS' || event.commandExit !== 0) throw new Error(`runner event is missing, ambiguous, failed, or forged: ${item.oldFullId}`);
    if (item.status !== 'PASS' || !rangesEqual(item.finalSourceRange, event.sourceRange)) throw new Error(`final source range is not the complete registered case: ${item.oldFullId}`);
    const parsed = caseEvidence(sourceText(item.finalFile, sourceRoot), item.finalFile, item.finalCaseTitle ?? item.runnerEvidence.title); if (!rangesEqual(item.finalSourceRange, parsed.sourceRange)) throw new Error(`final source range is foreign or truncated: ${item.oldFullId}`);
    if (!sameAssertionSemantics(item.finalAssertions ?? [], parsed.assertions)) throw new Error(`final assertions are not bound to the registered case: ${item.oldFullId}`);
    if (!item.assertionSemantics) throw new Error(`missing assertion judgment: ${item.oldFullId}`);
  }
  return {oldRows: before.length, reconciled: after.length, statuses: Object.groupBy(after, item => item.status), assertionJudgments: Object.groupBy(after, item => item.assertionSemantics), explicitOneToMany: after.filter(item => Array.isArray(item.finalFullIds) && item.finalFullIds.length > 1).length};
}
