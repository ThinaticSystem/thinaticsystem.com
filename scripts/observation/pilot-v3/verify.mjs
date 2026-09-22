import {readFileSync, writeFileSync} from 'node:fs';
import {verifyEvidence} from './oracle.mjs';
const runDir = process.argv[2];
if (!runDir) throw new Error('usage: node scripts/observation/pilot-v3/verify.mjs <run-dir>');
const before = JSON.parse(readFileSync(`${runDir}/before.json`, 'utf8')).entries;
const plan = JSON.parse(readFileSync(`${runDir}/mapping-plan.json`, 'utf8')).entries;
const after = JSON.parse(readFileSync(`${runDir}/after.json`, 'utf8')).entries;
const eventBundle = JSON.parse(readFileSync(`${runDir}/runner-events.json`, 'utf8'));
const commands = eventBundle.commands;
const valid = verifyEvidence({before, plan, after, events: eventBundle.events, commandExits: commands});
const fixtures = JSON.parse(readFileSync(new URL('./negative-fixtures.json', import.meta.url), 'utf8'));
const rejected = [];
for (const fixture of fixtures) {
  const mutatedBefore = structuredClone(before);
  const mutatedPlan = structuredClone(plan);
  const mutatedAfter = structuredClone(after);
  const mutatedEvents = structuredClone(eventBundle.events);
  if (fixture.mutation === 'missing-id') mutatedAfter[0].runnerEvidence.eventId = null;
  if (fixture.mutation === 'duplicate-id') mutatedAfter[1].runnerEvidence.eventId = mutatedAfter[0].runnerEvidence.eventId;
  if (fixture.mutation === 'fake-source-range') mutatedAfter[0].finalSourceRange = {startLine: 1, endLine: 1};
  if (fixture.mutation === 'dropped-matcher') mutatedAfter[0].assertionWitnesses = [];
  if (fixture.mutation === 'forged-pass') mutatedEvents.find(event => event.eventId === mutatedAfter[0].runnerEvidence.eventId).status = 'FAIL';
  try { verifyEvidence({before: mutatedBefore, plan: mutatedPlan, after: mutatedAfter, events: mutatedEvents, commandExits: commands}); } catch { rejected.push(fixture.name); }
}
if (rejected.length !== fixtures.length) throw new Error(`negative fixtures not rejected: ${rejected.length}/${fixtures.length}`);
const result = {status: 'PASS', valid, negativeFixtures: fixtures.map(fixture => ({name: fixture.name, rejected: true}))};
writeFileSync(`${runDir}/verification.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
