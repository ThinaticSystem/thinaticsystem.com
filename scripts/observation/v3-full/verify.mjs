import {readFileSync, writeFileSync} from 'node:fs';
import {REPO_ROOT, buildMapping, normalizedProjection, registrations, rowBindingFor, sameRowBinding, verifyEvidence} from './oracle.mjs';

const runDir = process.argv[2];
if (!runDir) throw new Error('usage: node scripts/observation/v3-full/verify.mjs <run-dir>');
const before = JSON.parse(readFileSync(`${runDir}/before.json`, 'utf8')).entries;
const after = JSON.parse(readFileSync(`${runDir}/after.json`, 'utf8')).entries;
const bundle = JSON.parse(readFileSync(`${runDir}/runner-events.json`, 'utf8'));
const valid = verifyEvidence({before, after, events: bundle.events, commands: bundle.commands});
const fixtures = JSON.parse(readFileSync(new URL('./negative-fixtures.json', import.meta.url), 'utf8'));
const rejected = [];
const stablePassed = [];
function sourceMutationRejected(fixture, after) {
  const target = after.find(item => item.oldEntryIndex === 142);
  if (!target?.finalRowBinding) throw new Error(`source mutation target is missing: ${fixture.name}`);
  const text = readFileSync(`${REPO_ROOT}/${target.finalFile}`, 'utf8');
  const range = target.finalRowBinding.registrationRange;
  const original = text.slice(range.startOffset, range.endOffset);
  const mutation = fixture.mutation === 'source-mutated-row-input' ? original.replace("'?autoplay=1'", "'?autoplay=2'") : original.replace('.toBeNull()', '.toBeUndefined()');
  if (mutation === original) throw new Error(`source mutation did not touch target: ${fixture.name}`);
  const mutatedText = text.slice(0, range.startOffset) + mutation + text.slice(range.endOffset);
  const candidates = registrations(mutatedText, target.finalFile).filter(item => item.range.startOffset === range.startOffset && item.range.endOffset === range.endOffset);
  if (candidates.length !== 1) return;
  try {
    const mutatedBinding = rowBindingFor(candidates[0], target.finalCaseTitle, target.finalFullId);
    if (!sameRowBinding(mutatedBinding, target.finalRowBinding)) return;
  } catch {
    return;
  }
  throw new Error(`source mutation was accepted: ${fixture.name}`);
}
for (const fixture of fixtures) {
  const mutatedAfter = structuredClone(after);
  const mutatedEvents = structuredClone(bundle.events);
  const mutatedCommands = structuredClone(bundle.commands);
  if (fixture.mutation === 'missing-id') mutatedAfter[0].runnerEvidence.eventId = null;
  if (fixture.mutation === 'duplicate-id') mutatedAfter[1].runnerEvidence.eventId = mutatedAfter[0].runnerEvidence.eventId;
  if (fixture.mutation === 'fake-source-range') mutatedAfter[0].finalSourceRange = {...mutatedAfter[0].finalSourceRange, startLine: 1, startOffset: 0};
  if (fixture.mutation === 'dropped-matcher') mutatedAfter[0].finalAssertions = [];
  if (fixture.mutation === 'forged-pass') mutatedEvents.find(event => event.eventId === mutatedAfter[0].runnerEvidence.eventId).status = 'FAIL';
  if (fixture.mutation === 'truncated-range') mutatedAfter[1].finalSourceRange = {...mutatedAfter[1].finalSourceRange, endLine: mutatedAfter[1].finalSourceRange.startLine, endOffset: mutatedAfter[1].finalSourceRange.startOffset + 1};
  if (fixture.mutation === 'duplicate-identity') mutatedEvents.push({...mutatedEvents[0], eventId: `${mutatedEvents[0].eventId}:duplicate`});
  if (fixture.mutation === 'nonzero-command') mutatedCommands.angular.exitCode = 2;
  if (fixture.mutation === 'empty-helper-signature') {
    const index = mutatedAfter.findIndex(item => item.baseHelperEvidence);
    mutatedAfter[index].baseHelperEvidence = null;
    mutatedAfter[index].finalHelperEvidence = null;
    mutatedAfter[index].assertionSemantics = 'SUPPORTED_EQUAL';
  }
  if (fixture.mutation === 'changed-helper-assertion') {
    const index = mutatedAfter.findIndex(item => item.baseHelperEvidence);
    mutatedAfter[index].assertionSemantics = 'SUPPORTED_HELPER_CONTRACT_EQUAL';
    mutatedAfter[index].finalHelperEvidence.contractAssertions[0].operands[1] = "'PASS'";
  }
  if (fixture.mutation === 'changed-helper-operand') {
    const index = mutatedAfter.findIndex(item => item.baseHelperEvidence);
    mutatedAfter[index].assertionSemantics = 'SUPPORTED_HELPER_CONTRACT_EQUAL';
    mutatedAfter[index].finalHelperEvidence.calls[0].operands[0] = 'evaluate(other)';
  }
  if (fixture.mutation === 'changed-helper-table-value') {
    const index = mutatedAfter.findIndex(item => item.baseHelperEvidence);
    mutatedAfter[index].assertionSemantics = 'SUPPORTED_HELPER_CONTRACT_EQUAL';
    mutatedAfter[index].finalHelperEvidence.tableBindings = [{name: 'malformed', values: 'changed'}];
  }
  if (fixture.mutation === 'changed-helper-expected-outcome') {
    const index = mutatedAfter.findIndex(item => item.baseHelperEvidence);
    mutatedAfter[index].assertionSemantics = 'SUPPORTED_HELPER_CONTRACT_EQUAL';
    mutatedAfter[index].finalHelperEvidence.expectedOutcome[0].operands[1] = "'PASS'";
  }
  if (fixture.mutation === 'cross-file-broad-template-capture') mutatedAfter[0].finalFile = mutatedAfter[200].finalFile;
  if (fixture.mutation === 'intra-file-gwt-template-capture') mutatedAfter[0].finalSourceRange = {...mutatedAfter[0].finalSourceRange, startLine: mutatedAfter[0].finalSourceRange.startLine + 1};
  if (fixture.mutation === 'same-title-foreign-owner') mutatedAfter[0].finalFile = mutatedAfter.find(item => item.finalFile !== mutatedAfter[0].finalFile).finalFile;
  if (fixture.mutation === 'same-full-id-foreign-owner') mutatedAfter[0].runnerEvidence.fullId = mutatedAfter[1].runnerEvidence.fullId;
  if (fixture.mutation === 'shared-dynamic-registration') {
    const groups = new Map();
    for (const [index, item] of mutatedAfter.entries()) {
      const binding = item.finalRowBinding;
      if (!binding) continue;
      const key = `${item.finalFile}:${binding.registrationRange.startOffset}:${binding.registrationRange.endOffset}`;
      const group = groups.get(key) ?? [];
      group.push(index);
      groups.set(key, group);
    }
    const group = [...groups.values()].find(indexes => indexes.length > 1);
    if (!group) throw new Error('shared-dynamic-registration fixture has no dynamic group');
    mutatedAfter[group[1]].finalRowBinding.rowKey = mutatedAfter[group[0]].finalRowBinding.rowKey;
  }
  if (fixture.mutation === 'duplicate-old-row-assignment') mutatedAfter[1].runnerEvidence = structuredClone(mutatedAfter[0].runnerEvidence);
  if (fixture.mutation === 'changed-row-input') {
    const index = mutatedAfter.findIndex(item => item.finalRowBinding);
    mutatedAfter[index].runnerEvidence.rowBinding.rowInput.title = 'changed row input';
  }
  if (fixture.mutation === 'changed-row-expected-outcome') {
    const index = mutatedAfter.findIndex(item => item.finalRowBinding);
    mutatedAfter[index].runnerEvidence.rowBinding.expectedResult.runtimeTitle = 'changed expected outcome';
  }
  if (fixture.mutation === 'reordered-angular-assertions') {
    const indexes = mutatedEvents.map((event, index) => event.runner === 'angular' ? index : -1).filter(index => index >= 0);
    [mutatedEvents[indexes[0]], mutatedEvents[indexes[1]]] = [mutatedEvents[indexes[1]], mutatedEvents[indexes[0]]];
  }
  if (fixture.mutation === 'source-mutated-row-input' || fixture.mutation === 'source-mutated-row-expected-outcome') {
    try { sourceMutationRejected(fixture, after); rejected.push(fixture.name); } catch { throw new Error(`source mutation negative was not rejected: ${fixture.name}`); }
    continue;
  }
  try {
    verifyEvidence({before, after: mutatedAfter, events: mutatedEvents, commands: mutatedCommands});
    if (fixture.expect === 'stable') {
      const remapped = buildMapping(before, mutatedEvents).after;
      if (JSON.stringify(normalizedProjection(remapped)) !== JSON.stringify(normalizedProjection(after))) throw new Error(`report-order projection changed: ${fixture.name}`);
      stablePassed.push(fixture.name);
    }
  } catch {
    if (fixture.expect === 'stable') throw new Error(`stability fixture rejected: ${fixture.name}`);
    rejected.push(fixture.name);
  }
}
const rejectedFixtures = fixtures.filter(fixture => fixture.expect !== 'stable');
const stableFixtures = fixtures.filter(fixture => fixture.expect === 'stable');
if (rejected.length !== rejectedFixtures.length) throw new Error(`negative fixtures not rejected: ${rejected.length}/${rejectedFixtures.length}`);
if (stablePassed.length !== stableFixtures.length) throw new Error(`stability fixtures not preserved: ${stablePassed.length}/${stableFixtures.length}`);
const result = {status: valid.status, valid, negativeFixtures: rejectedFixtures.map(fixture => ({name: fixture.name, rejected: true})), stabilityFixtures: stableFixtures.map(fixture => ({name: fixture.name, preserved: true}))};
writeFileSync(`${runDir}/verification.json`, JSON.stringify(result, null, 2) + String.fromCharCode(10));
console.log(JSON.stringify(result, null, 2));
