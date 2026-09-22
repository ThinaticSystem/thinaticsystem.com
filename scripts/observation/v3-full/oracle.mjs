import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

export const BASE_COMMIT = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';
export const REPO_ROOT = '/home/ts/site-development/thinaticsystem-renovate-20260921';
export const BEFORE_MAP = '/home/ts/site-development/pr83-ci-test-delivery-evidence/before/observation-map-before.json';
export const BEFORE_TAP = '/home/ts/site-development/pr83-ci-test-delivery-evidence/before/node-tests-before.tap';
export const EXPECTED_PRECONDITION_INDICES = [700, 701, 702];
const rel = file => file.startsWith(`${REPO_ROOT}/`) ? file.slice(REPO_ROOT.length + 1) : file;
const sha = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const scriptKind = file => file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
const literalText = node => ts.isStringLiteralLike(node) ? node.text : null;
function registrationParts(node) {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression) && (node.expression.text === 'it' || node.expression.text === 'test') && node.arguments.length >= 2) {
    const callback = [...node.arguments].slice(1).reverse().find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
    if (callback) return {title: node.arguments[0], callback};
  }
  if (ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'each' && ts.isIdentifier(node.expression.expression.expression) && (node.expression.expression.expression.text === 'it' || node.expression.expression.expression.text === 'test') && node.arguments.length >= 2 && (ts.isArrowFunction(node.arguments[1]) || ts.isFunctionExpression(node.arguments[1]))) return {title: node.arguments[0], callback: node.arguments[1], table: node.expression.arguments[0]};
  return null;
}
const isRegistration = node => registrationParts(node) !== null;
const isTestFile = file => file.endsWith('.spec.ts') || file.endsWith('.spec.test.mjs') || file.endsWith('.test.mjs');

function sourceFile(text, file) { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file)); }
function normalizedText(sf, node) { return sf.text.slice(node.getStart(sf), node.end).replace(/\s+/g, ' ').trim(); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function titlePattern(sf, node) {
  if (ts.isStringLiteralLike(node)) return `^${node.text.split(/%s|\$[A-Za-z_][A-Za-z0-9_]*/).map(escapeRegExp).join('[\\s\\S]*')}$`;
  if (ts.isTemplateExpression(node)) {
    let pattern = escapeRegExp(node.head.text);
    for (const span of node.templateSpans) pattern += '[\\s\\S]*' + escapeRegExp(span.literal.text);
    return `^${pattern}$`;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = titlePattern(sf, node.left).replace(/^\^|\$$/g, '');
    const right = titlePattern(sf, node.right).replace(/^\^|\$$/g, '');
    return `^${left}${right}$`;
  }
  return '^.*$';
}
function rangeOf(sf, node, file) {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end = sf.getLineAndCharacterOfPosition(node.end);
  return {file, startLine: start.line + 1, endLine: end.line + 1, startOffset: node.getStart(sf), endOffset: node.end};
}
function signatureForCall(sf, node) {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const matcher = node.expression.name.text;
  let receiver = node.expression.expression;
  let negated = false;
  if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'not') { negated = true; receiver = receiver.expression; }
  if (ts.isCallExpression(receiver) && ts.isIdentifier(receiver.expression) && receiver.expression.text === 'expect') {
    return {operator: 'expect', callKind: 'matcher', negated, matcher, operands: receiver.arguments.map(argument => normalizedText(sf, argument)), arguments: node.arguments.map(argument => normalizedText(sf, argument)), source: rangeOf(sf, node, sf.fileName)};
  }
  if (ts.isIdentifier(receiver) && receiver.text === 'assert') {
    return {operator: 'assert', callKind: matcher, negated: false, matcher, operands: node.arguments.map(argument => normalizedText(sf, argument)), arguments: node.arguments.map(argument => normalizedText(sf, argument)), source: rangeOf(sf, node, sf.fileName)};
  }
  return null;
}
function assertionSignatures(sf, callback) {
  const result = [];
  const visit = node => { if (ts.isCallExpression(node)) { const signature = signatureForCall(sf, node); if (signature) result.push(signature); } ts.forEachChild(node, visit); };
  visit(callback);
  return result.sort((left, right) => left.source.startOffset - right.source.startOffset);
}
function uniqueRanges(ranges) {
  const seen = new Set();
  return ranges.filter(range => { const key = `${range.file}:${range.startOffset}:${range.endOffset}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
function sourceBindingRanges(sf, registration) {
  const ranges = [registration.range];
  const tableNames = new Set();
  let parent = registration.node.parent;
  while (parent && !ts.isSourceFile(parent)) {
    if (ts.isForStatement(parent) || ts.isForOfStatement(parent) || ts.isForInStatement(parent)) {
      ranges.push(rangeOf(sf, parent, sf.fileName));
      const expression = ts.isForStatement(parent) ? parent.initializer ?? parent.condition ?? parent.incrementor : parent.expression;
      if (expression) {
        const collect = node => { if (ts.isIdentifier(node)) tableNames.add(node.text); ts.forEachChild(node, collect); };
        collect(expression);
      }
    }
    parent = parent.parent;
  }
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && tableNames.has(node.name.text)) ranges.push(rangeOf(sf, node, sf.fileName));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return uniqueRanges(ranges);
}
function tableBindings(sf, registration) {
  const names = new Set();
  let parent = registration.node.parent;
  while (parent && !ts.isSourceFile(parent)) {
    if (ts.isForStatement(parent) || ts.isForOfStatement(parent) || ts.isForInStatement(parent)) {
      const expression = ts.isForStatement(parent) ? parent.initializer ?? parent.condition ?? parent.incrementor : parent.expression;
      if (expression) {
        const collect = node => { if (ts.isIdentifier(node)) names.add(node.text); ts.forEachChild(node, collect); };
        collect(expression);
      }
    }
    parent = parent.parent;
  }
  const result = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.has(node.name.text) && node.initializer) result.push({name: node.name.text, range: rangeOf(sf, node, sf.fileName), values: normalizedText(sf, node.initializer)});
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return result;
}
function helperDefinition(sf, helperName) {
  let result = null;
  const visit = node => {
    if (result) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === helperName && node.body) result = {callback: node.body, range: rangeOf(sf, node, sf.fileName)};
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === helperName && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) result = {callback: node.initializer.body, range: rangeOf(sf, node, sf.fileName)};
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return result;
}
function helperOperations(sf, callback) {
  const operations = [];
  const visit = node => {
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken].includes(node.operatorToken.kind)) operations.push({kind: 'assignment', target: normalizedText(sf, node.left), operator: node.operatorToken.getText(sf), value: normalizedText(sf, node.right), range: rangeOf(sf, node, sf.fileName)});
    else if (ts.isCallExpression(node)) operations.push({kind: 'call', callee: normalizedText(sf, node.expression), operands: node.arguments.map(argument => normalizedText(sf, argument)), range: rangeOf(sf, node, sf.fileName)});
    ts.forEachChild(node, visit);
  };
  visit(callback);
  return operations;
}
function helperEvidence(sf, registration) {
  const calls = [];
  const visit = node => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'assertInvalid') calls.push(node); ts.forEachChild(node, visit); };
  visit(registration.node.arguments[1]);
  if (!calls.length) return null;
  const definition = helperDefinition(sf, 'assertInvalid');
  if (!definition) return {kind: 'assertInvalid', supported: false, calls: calls.map(call => ({range: rangeOf(sf, call, sf.fileName), operands: call.arguments.map(argument => normalizedText(sf, argument))})), bindingRanges: sourceBindingRanges(sf, registration)};
  const contractAssertions = assertionSignatures(sf, definition.callback);
  return {
    kind: 'assertInvalid',
    supported: contractAssertions.length > 0,
    helperDefinitionRange: definition.range,
    contractAssertions,
    calls: calls.map(call => ({range: rangeOf(sf, call, sf.fileName), operands: call.arguments.map(argument => normalizedText(sf, argument))})),
    operations: helperOperations(sf, registration.node.arguments[1]),
    bindingRanges: sourceBindingRanges(sf, registration),
    tableBindings: tableBindings(sf, registration),
    expectedOutcome: contractAssertions.map(({operator, callKind, negated, matcher, operands, arguments: args}) => ({operator, callKind, negated, matcher, operands, arguments: args})),
  };
}
function helperSemantic(evidence) {
  if (!evidence) return null;
  return {kind: evidence.kind, supported: evidence.supported, contractAssertions: semanticPart(evidence.contractAssertions ?? []), calls: (evidence.calls ?? []).map(({operands}) => ({operands})), operations: (evidence.operations ?? []).map(({kind, callee, operands, target, operator, value}) => ({kind, callee, operands, target, operator, value})), tableBindings: (evidence.tableBindings ?? []).map(({name, values}) => ({name, values})), expectedOutcome: evidence.expectedOutcome ?? []};
}
function sameHelperEvidence(left, right) { return JSON.stringify(helperSemantic(left)) === JSON.stringify(helperSemantic(right)); }
function registrations(text, file) {
  const sf = sourceFile(text, file);
  const result = [];
  const visit = (node, ancestors = []) => {
    if (isRegistration(node)) {
      const parts = registrationParts(node);
      const titleNode = parts.title;
      result.push({file, title: literalText(titleNode), titlePattern: titlePattern(sf, titleNode), titleExpression: normalizedText(sf, titleNode), ancestors, range: rangeOf(sf, node, file), assertions: assertionSignatures(sf, parts.callback), helperEvidence: helperEvidence(sf, {node, range: rangeOf(sf, node, file)}), node});
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'describe' && node.arguments.length >= 2 && literalText(node.arguments[0]) !== null) {
      const next = [...ancestors, literalText(node.arguments[0])];
      ts.forEachChild(node, child => visit(child, next));
      return;
    }
    ts.forEachChild(node, child => visit(child, ancestors));
  };
  visit(sf);
  return result.map((item, index) => ({...item, ordinal: index}));
}
function filesAtCommit(commit = null) {
  const args = commit ? ['ls-tree', '-r', '--name-only', commit] : ['ls-files'];
  return execFileSync('git', args, {cwd: REPO_ROOT, encoding: 'utf8'}).split(String.fromCharCode(10)).filter(isTestFile);
}
function textAtCommit(file, commit = BASE_COMMIT) { return execFileSync('git', ['show', `${commit}:${file}`], {cwd: REPO_ROOT, encoding: 'utf8'}); }
function sourceText(file, root = REPO_ROOT) { return readFileSync(resolve(root, file), 'utf8'); }
function buildRegistry(commit = null) {
  const result = [];
  for (const file of filesAtCommit(commit)) {
    let text;
    try { text = commit ? textAtCommit(file, commit) : readFileSync(resolve(REPO_ROOT, file), 'utf8'); } catch { continue; }
    for (const item of registrations(text, file)) result.push(item);
  }
  return result;
}
function semanticPart(assertions) { return assertions.map(({source, ...rest}) => rest); }
function semanticKey(assertions) { return JSON.stringify(semanticPart(assertions)); }
function sameAssertions(left, right) { return semanticKey(left) === semanticKey(right); }
function identity(event) { return `${event.runner}\u0000${event.file}\u0000${event.fullId}`; }
function fullId(item, runner) { return runner === 'angular' ? [...item.ancestors, item.title].join(' ') : item.title; }
function occurrence(entries, value) { return entries.filter(entry => entry === value).length; }
function parseTapTitles(tap) {
  const result = [];
  for (const line of tap.split(String.fromCharCode(10))) {
    const match = line.match(/^(ok|not ok) (\d+) - (.+)$/);
    if (match) result.push({ordinal: Number(match[2]), title: match[3], status: match[1] === 'ok' ? 'PASS' : 'FAIL'});
  }
  return result;
}
function pilotFinal(oldFullId) {
  const values = {
    'AppComponent should create the app': {file: 'src/app/app.component.spec.ts', fullId: 'AppComponent Given the application shell is rendered When the component is created Then it exposes an application instance'},
    'AppComponent should expose semantic shell controls': {file: 'src/app/app.component.spec.ts', fullId: 'AppComponent Given the application shell is rendered When a user toggles theme and menu controls Then semantic state and navigation are exposed'},
    'NotificationService should be created': {file: 'src/app/services/notification.service.spec.ts', fullId: 'NotificationService Given the service is injected When the service is created Then it is available'},
    'NotificationService lifetime [notification-replacement-lifetime] gives each replacement its full three seconds': {file: 'src/app/services/notification.service.regression.spec.ts', fullId: 'NotificationService regression witnesses Given a timer-backed service When a replacement arrives near expiry Then each message gets a full three seconds'},
    'NotificationService lifetime repeated replacements keep one timer and preserve the default message': {file: 'src/app/services/notification-lifetime.spec.ts', fullId: 'NotificationService Given a fresh service with fake timers When blank and omitted messages replace content Then one timer and the default message remain'},
    'NotificationService lifetime releases its timer when the injector destroys the service': {file: 'src/app/services/notification-lifetime.spec.ts', fullId: 'NotificationService Given a fresh service with fake timers When the injector destroys the service Then its timer is released'},
    'begin owns in-flight requests before a terminal callback exists': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given a new ledger, when a request begins before its terminal callback, then the request remains owned with unknown bytes'},
    'child begun during drain stays owned and has explicit tail scope': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given a parent request and a child request, when the parent finishes during drain, then the child stays in the tail scope'},
    'unknown bytes are null, failures remain failures, illegal terminals reject': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given an image request with unknown bytes, when it fails, then failure and invalid terminal transitions remain explicit'},
    'page clock reset cannot erase request IDs or preceding owner records': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given requests recorded across owners, when the page clock resets, then IDs and preceding owner records remain addressable'},
    'CMS fixtures reject unknown host, path, query and method': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given the CMS fixture table, when an unknown host path query or method is requested, then no fixture is returned'},
    'detail fixture matches actual CMS arrays and rich markdown exercises overrides': {file: 'scripts/performance/recorder.spec.test.mjs', fullId: 'Given the detail and article fixtures, when CMS arrays and rich markdown are consumed, then all overrides remain visible'},
  };
  return values[oldFullId] ?? null;
}
function matchesTitle(item, title) { return item.title === title || (item.titlePattern && new RegExp(item.titlePattern).test(title)); }
function fileVariants(entry) {
  return new Set([entry.baseFile, entry.proposedFile, entry.baseFile?.replace(/\.test\.mjs$/, '.spec.test.mjs'), entry.baseFile?.replace(/\.mjs$/, '.spec.test.mjs')].filter(Boolean));
}
function findBaseCase(entry, registry, priorSameTitle) {
  const title = entry.runner === 'angular' ? entry.scenarioSignificantInput?.title : entry.scenarioSignificantInput?.title ?? entry.oldFullTestId;
  let candidates = registry.filter(item => matchesTitle(item, title));
  if (entry.runner === 'angular' && entry.ownerSource) {
    const inOwner = candidates.filter(item => item.file === entry.ownerSource);
    if (inOwner.length) candidates = inOwner;
  }
  if (entry.runner === 'angular' && entry.scenarioSignificantInput?.ancestorTitles?.length) {
    const ancestors = entry.scenarioSignificantInput.ancestorTitles;
    const withAncestors = candidates.filter(item => JSON.stringify(item.ancestors) === JSON.stringify(ancestors));
    if (withAncestors.length) candidates = withAncestors;
  }
  if (!candidates.length) throw new Error(`base registration not found for old index ${entry.oldEntryIndex ?? '?'}: ${entry.oldFullTestId}`);
  const index = Math.max(0, priorSameTitle);
  return candidates[index] ?? candidates[0];
}
function locateCurrentCase(event, registry, titleOccurrence) {
  const candidates = registry.filter(item => matchesTitle(item, event.title));
  const item = candidates[titleOccurrence] ?? candidates[0];
  if (!item) throw new Error(`final registration not found: ${event.title}`);
  return item;
}
export function buildBeforeEvidence(observationMap, baseRegistry, baseTap) {
  const titleCounts = new Map();
  let angularOrdinal = 0;
  const entries = observationMap.entries ?? [];
  return entries.map((entry, oldEntryIndex) => {
    const title = entry.runner === 'angular' ? entry.scenarioSignificantInput?.title : entry.scenarioSignificantInput?.title ?? entry.oldFullTestId;
    const prior = titleCounts.get(`${entry.runner}\u0000${title}`) ?? 0;
    titleCounts.set(`${entry.runner}\u0000${title}`, prior + 1);
    const found = findBaseCase({...entry, oldEntryIndex}, baseRegistry, prior);
    const runnerOrdinal = entry.runner === 'angular' ? angularOrdinal++ : Number(entry.importantAssertion?.statusLine?.match(/^(?:ok|not ok) (\d+)/)?.[1] ?? oldEntryIndex + 1);
    return {oldEntryIndex, runnerOrdinal, stableKey: `${entry.runner}:${oldEntryIndex}:${sha(entry.oldFullTestId)}`, runner: entry.runner, oldFullId: entry.oldFullTestId, plannedFinalId: entry.proposedFullTestId ?? null, baseCommit: BASE_COMMIT, baseFile: found.file, proposedFile: entry.proposedFile ?? found.file, baseSourceRange: found.range, baseRegistrationOrdinal: baseRegistry.filter(item => item.file === found.file).indexOf(found), baseAncestors: found.ancestors, baseCaseTitle: found.title, meaningfulInput: entry.scenarioSignificantInput ?? null, expectedResult: entry.expectedResult, originalRunnerAssertion: entry.importantAssertion ?? null, baseAssertions: found.assertions, helperEvidence: found.helperEvidence, errorBoundary: entry.boundaryObservation ?? [], classification: 'normative-specification'};
  });
}
export function buildEvents(angularReport, nodeTap, currentRegistry, commands) {
  const events = [];
  let angularOrdinal = 0;
  const angularTitleCounts = new Map();
  for (const fileResult of angularReport?.testResults ?? []) for (const assertion of fileResult.assertionResults ?? []) {
    const title = assertion.title;
    const countKey = `angular\u0000${fileResult.name}\u0000${title}`;
    const prior = angularTitleCounts.get(countKey) ?? 0;
    angularTitleCounts.set(countKey, prior + 1);
    const file = rel(fileResult.name);
    const candidates = currentRegistry.filter(item => item.file === file && matchesTitle(item, title));
    const item = candidates[prior] ?? candidates[0];
    if (!item) throw new Error(`current Angular registration not found: ${file}:${title}`);
    events.push({eventId: `angular:${file}:${assertion.fullName}`, runner: 'angular', file, fullId: assertion.fullName, status: assertion.status === 'passed' ? 'PASS' : 'FAIL', title, runnerOrdinal: angularOrdinal++, sourceRange: item.range, caseOrdinal: currentRegistry.filter(candidate => candidate.file === file).indexOf(item), assertions: item.assertions, helperEvidence: item.helperEvidence, command: commands.angular.command, commandExit: commands.angular.exitCode});
  }
  const tapEvents = parseTapTitles(nodeTap);
  const nodeTitleCounts = new Map();
  for (const tap of tapEvents) {
    const prior = nodeTitleCounts.get(tap.title) ?? 0;
    nodeTitleCounts.set(tap.title, prior + 1);
    const item = locateCurrentCase({title: tap.title}, currentRegistry.filter(candidate => candidate.file.endsWith('.mjs')), prior);
    events.push({eventId: `node-tap:${tap.ordinal}:${tap.title}`, runner: 'node-tap', file: item.file, fullId: tap.title, status: tap.status, title: tap.title, runnerOrdinal: tap.ordinal, sourceRange: item.range, caseOrdinal: currentRegistry.filter(candidate => candidate.file === item.file).indexOf(item), assertions: item.assertions, helperEvidence: item.helperEvidence, command: commands.node.command, commandExit: commands.node.exitCode});
  }
  return events;
}
export function buildMapping(before, events) {
  const used = new Set();
  const byOldTitle = new Map();
  const after = [];
  for (const entry of before) {
    const pilot = pilotFinal(entry.oldFullId);
    let candidates;
    if (pilot) candidates = events.filter(event => event.runner === entry.runner && event.file === pilot.file && event.fullId === pilot.fullId);
    else candidates = events.filter(event => event.runner === entry.runner && fileVariants(entry).has(event.file) && event.fullId === entry.oldFullId);
    if (!candidates.length && entry.plannedFinalId) {
      candidates = events.filter(event => event.runner === entry.runner && fileVariants(entry).has(event.file) && event.fullId === entry.plannedFinalId);
      const ordinalMatch = candidates.filter(event => event.runnerOrdinal === entry.runnerOrdinal);
      if (ordinalMatch.length) candidates = ordinalMatch;
    }
    if (!candidates.length) candidates = events.filter(event => event.runner === entry.runner && fileVariants(entry).has(event.file) && event.runnerOrdinal === entry.runnerOrdinal);
    if (!candidates.length) candidates = events.filter(event => event.runner === entry.runner && event.runnerOrdinal === entry.runnerOrdinal);
    if (!candidates.length && entry.helperEvidence) candidates = events.filter(event => event.runner === entry.runner && fileVariants(entry).has(event.file) && event.caseOrdinal === entry.baseRegistrationOrdinal && event.helperEvidence);
    if (!candidates.length) {
      const prior = byOldTitle.get(`${entry.runner}\u0000${entry.oldFullId}`) ?? 0;
      byOldTitle.set(`${entry.runner}\u0000${entry.oldFullId}`, prior + 1);
      candidates = events.filter(event => event.runner === entry.runner && fileVariants(entry).has(event.file) && sameAssertions(event.assertions, entry.baseAssertions));
      candidates = candidates.filter(event => !used.has(identity(event)));
      if (!candidates.length) throw new Error(`final runner case not found for old index ${entry.oldEntryIndex}: ${entry.oldFullId}`);
    }
    const unusedCandidates = candidates.filter(event => !used.has(identity(event)));
    const reusedIdentity = candidates.length > 0 && unusedCandidates.length === 0;
    candidates = unusedCandidates.length ? unusedCandidates : candidates;
    if (!candidates.length) throw new Error(`final runner case is ambiguous/used for old index ${entry.oldEntryIndex}: ${entry.oldFullId}`);
    const event = candidates[0];
    used.add(identity(event));
    const helperSupported = entry.helperEvidence?.supported && event.helperEvidence?.supported && sameHelperEvidence(entry.helperEvidence, event.helperEvidence);
    const judgment = entry.helperEvidence ? (helperSupported ? 'SUPPORTED_HELPER_CONTRACT_EQUAL' : 'UNKNOWN/manual independent review required') : (entry.baseAssertions.length === 0 || event.assertions.length === 0 ? 'UNKNOWN/manual independent review required' : (sameAssertions(entry.baseAssertions, event.assertions) ? 'SUPPORTED_EQUAL' : 'UNKNOWN/manual independent review required'));
    const status = EXPECTED_PRECONDITION_INDICES.includes(entry.oldEntryIndex) && event.status === 'FAIL' ? 'PRECONDITION_PRESERVED' : event.status;
    after.push({oldEntryIndex: entry.oldEntryIndex, oldStableKey: entry.stableKey, oldFullId: entry.oldFullId, classification: pilot?.file.includes('.regression.') ? 'concrete-regression' : entry.classification, mappingResolution: reusedIdentity ? 'reused-runtime-identity-manual-review' : (fileVariants(entry).has(event.file) ? 'source-file-or-planned-id' : 'runtime-ordinal-manual-review'), finalFile: event.file, finalFullId: event.fullId, finalSourceRange: event.sourceRange, finalCaseOrdinal: event.caseOrdinal, finalCaseTitle: event.title, baseAssertions: entry.baseAssertions, finalAssertions: event.assertions, baseHelperEvidence: entry.helperEvidence, finalHelperEvidence: event.helperEvidence, assertionSemantics: judgment, manualReviewItem: reusedIdentity ? 'Duplicate source identity requires independent row-level reconciliation; not accepted mechanically.' : (judgment.startsWith('UNKNOWN') ? 'Compare exact source diff and preserved assertion/boundary semantics independently.' : null), errorBoundary: entry.errorBoundary, status, runnerEvidence: {eventId: event.eventId, runner: event.runner, command: event.command, commandExit: event.commandExit, fullId: event.fullId, file: event.file, title: event.title, status: event.status, sourceRange: event.sourceRange, assertions: event.assertions, helperEvidence: event.helperEvidence}});
  }
  return {after, mappedIdentities: used};
}
function rangesEqual(left, right) { return left?.file === right?.file && left?.startLine === right?.startLine && left?.endLine === right?.endLine && left?.startOffset === right?.startOffset && left?.endOffset === right?.endOffset; }
export function verifyEvidence({before, after, events, commands, sourceRoot = REPO_ROOT}) {
  if (before.length !== 945 || after.length !== 945) throw new Error(`expected 945 old rows, got ${before.length}/${after.length}`);
  if (before.filter(item => item.runner === 'angular').length !== 200 || before.filter(item => item.runner === 'node-tap').length !== 745) throw new Error('old Angular/Node counts are not exactly 200/745');
  if (new Set(before.map(item => item.stableKey)).size !== before.length) throw new Error('duplicate stable key');
  if (commands.angular.exitCode !== 0) throw new Error(`unexpected Angular command exit ${commands.angular.exitCode}`);
  const identities = new Map(); for (const event of events) identities.set(identity(event), (identities.get(identity(event)) ?? 0) + 1);
  for (const item of after) if ((identities.get(`${item.runnerEvidence.runner}\u0000${item.finalFile}\u0000${item.finalFullId}`) ?? 0) !== 1) throw new Error(`missing or duplicate actual identity: ${item.oldFullId}`);
  for (const item of after) {
    const event = events.find(candidate => candidate.eventId === item.runnerEvidence.eventId);
    if (!event) throw new Error(`missing actual event: ${item.oldFullId}`);
    if (event.runner !== item.runnerEvidence.runner || event.file !== item.finalFile || event.fullId !== item.finalFullId) throw new Error(`runner event identity does not match final case: ${item.oldFullId}`);
    const parsed = registrations(sourceText(item.finalFile, sourceRoot), item.finalFile).find(candidate => candidate.range.startOffset === item.finalSourceRange.startOffset && candidate.range.endOffset === item.finalSourceRange.endOffset);
    if (!parsed || !rangesEqual(item.finalSourceRange, parsed.range)) throw new Error(`foreign/truncated final source range: ${item.oldFullId}`);
    if (!sameAssertions(item.finalAssertions ?? [], parsed.assertions)) throw new Error(`assertions are not bound to final case: ${item.oldFullId}`);
    if (!sameHelperEvidence(item.finalHelperEvidence, parsed.helperEvidence)) throw new Error(`helper evidence is not bound to final case: ${item.oldFullId}`);
    if ((item.baseAssertions.length === 0 || item.finalAssertions.length === 0) && !item.baseHelperEvidence && item.assertionSemantics === 'SUPPORTED_EQUAL') throw new Error(`empty assertion signatures were accepted without helper evidence: ${item.oldFullId}`);
    if (item.assertionSemantics === 'SUPPORTED_HELPER_CONTRACT_EQUAL' && (!item.baseHelperEvidence?.supported || !item.finalHelperEvidence?.supported || !sameHelperEvidence(item.baseHelperEvidence, item.finalHelperEvidence))) throw new Error(`helper contract preservation is not source-bound: ${item.oldFullId}`);
    if (item.status === 'PASS') { if (event.status !== 'PASS' || (event.runner === 'angular' ? event.commandExit !== 0 : ![0, 1].includes(event.commandExit))) throw new Error(`non-PASS old row marked PASS: ${item.oldFullId}`); }
    else if (item.status === 'PRECONDITION_PRESERVED') { if (!EXPECTED_PRECONDITION_INDICES.includes(item.oldEntryIndex) || event.status !== 'FAIL') throw new Error(`invalid precondition witness: ${item.oldFullId}`); }
    else throw new Error(`unexpected final failure: ${item.oldFullId}`);
    if (!item.assertionSemantics || /passed-or-reconciled/i.test(JSON.stringify(item))) throw new Error(`missing bounded judgment: ${item.oldFullId}`);
  }
  const nodeExit = commands.node.exitCode;
  if (nodeExit !== 0 && !(nodeExit === 1 && after.filter(item => item.status === 'PRECONDITION_PRESERVED').length === 3)) throw new Error(`unexpected Node command exit ${nodeExit}`);
  return {status: nodeExit === 0 ? 'PASS' : 'PASS_WITH_PRESERVED_PRECONDITIONS', oldRows: 945, oldAngular: 200, oldNode: 745, oldPass: after.filter(item => item.status === 'PASS').length, preconditionPreserved: after.filter(item => item.status === 'PRECONDITION_PRESERVED').length, manualReview: after.filter(item => item.assertionSemantics.startsWith('UNKNOWN')).map(item => item.oldEntryIndex), identities: {planned: after.length, actualUnique: [...identities.values()].filter(count => count === 1).length}};
}
export function loadObservationMap() { return JSON.parse(readFileSync(BEFORE_MAP, 'utf8')); }
export function loadBeforeTap() { return readFileSync(BEFORE_TAP, 'utf8'); }
export {buildRegistry, filesAtCommit, fullId, identity, registrations, semanticKey, textAtCommit};
