import {readFileSync, writeFileSync} from 'node:fs';
import {verifyEvidence} from './oracle.mjs';

const runDir = process.argv[2];
if (!runDir) throw new Error('usage: node scripts/observation/v3-full/verify.mjs <run-dir>');
const before = JSON.parse(readFileSync(`${runDir}/before.json`, 'utf8')).entries;
const after = JSON.parse(readFileSync(`${runDir}/after.json`, 'utf8')).entries;
const bundle = JSON.parse(readFileSync(`${runDir}/runner-events.json`, 'utf8'));
const valid = verifyEvidence({before, after, events: bundle.events, commands: bundle.commands});
const fixtures = JSON.parse(readFileSync(new URL('./negative-fixtures.json', import.meta.url), 'utf8'));
const rejected = [];
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
  try { verifyEvidence({before, after: mutatedAfter, events: mutatedEvents, commands: mutatedCommands}); }
  catch { rejected.push(fixture.name); }
}
if (rejected.length !== fixtures.length) throw new Error(`negative fixtures not rejected: ${rejected.length}/${fixtures.length}`);
const result = {status: valid.status, valid, negativeFixtures: fixtures.map(fixture => ({name: fixture.name, rejected: true}))};
writeFileSync(`${runDir}/verification.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
