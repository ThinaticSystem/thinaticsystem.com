import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildBeforeEvidence, buildEvents, buildMapping, buildRegistry, loadBeforeTap, loadObservationMap, verifyEvidence, REPO_ROOT, filesAtCommit} from './oracle.mjs';

const evidenceRoot = '/home/ts/site-development/pr83-ci-test-delivery-evidence/v3-full';
mkdirSync(evidenceRoot, {recursive: true});
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
let runDir = join(evidenceRoot, `run-${stamp}`);
let suffix = 1;
while (existsSync(runDir)) runDir = join(evidenceRoot, `run-${stamp}-${suffix++}`);
mkdirSync(join(runDir, 'raw'), {recursive: true});
const nodePath = '/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin/node';
const env = {...process.env, PATH: `/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin:/run/current-system/sw/bin`};

function run(command, args, outputName) {
  const result = spawnSync(command, args, {cwd: REPO_ROOT, env, encoding: 'utf8'});
  writeFileSync(join(runDir, 'raw', `${outputName}.stdout`), result.stdout ?? '');
  writeFileSync(join(runDir, 'raw', `${outputName}.stderr`), result.stderr ?? '');
  return {status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? ''};
}

const angularReport = join(runDir, 'raw', 'angular-report.json');
const angularArgs = ['pnpm', 'exec', 'ng', 'test', '--watch=false', '--no-progress', '--reporters=json', `--output-file=${angularReport}`];
const angular = run('corepack', angularArgs, 'angular');
if (!existsSync(angularReport)) throw new Error(`Angular JSON report was not produced (exit ${angular.status})`);
writeFileSync(join(runDir, 'angular-report.json'), readFileSync(angularReport));
const nodeFiles = filesAtCommit(null).filter(file => file.endsWith('.spec.test.mjs') || file.endsWith('.test.mjs'));
const nodeArgs = ['--test', '--test-reporter=tap', ...nodeFiles];
const node = run(nodePath, nodeArgs, 'node');
writeFileSync(join(runDir, 'node.tap'), node.stdout);
const commands = {
  angular: {runner: 'angular', command: `PATH=${env.PATH} corepack ${angularArgs.join(' ')}`, exitCode: angular.status},
  node: {runner: 'node-tap', command: `${nodePath} ${nodeArgs.join(' ')}`, exitCode: node.status},
};
const baseRegistry = buildRegistry('7a8352242951516a2380e8fc69c5fb902b0c0e5d');
const currentRegistry = buildRegistry(null);
const before = buildBeforeEvidence(loadObservationMap(), baseRegistry, loadBeforeTap());
const events = buildEvents(JSON.parse(readFileSync(join(runDir, 'angular-report.json'), 'utf8')), node.stdout, currentRegistry, commands);
const mapping = buildMapping(before, events);
const after = mapping.after;
const planned = new Set(after.map(item => `${item.runnerEvidence.runner}\u0000${item.finalFile}\u0000${item.finalFullId}`));
const additionalCases = events.filter(event => !planned.has(`${event.runner}\u0000${event.file}\u0000${event.fullId}`)).map(event => ({...event, classification: event.file.includes('.regression.') ? 'additional-new-regression' : 'additional-final-case'}));
const preconditionWitnesses = after.filter(item => item.status === 'PRECONDITION_PRESERVED').map(item => ({oldEntryIndex: item.oldEntryIndex, oldFullId: item.oldFullId, status: item.status, commandExit: item.runnerEvidence.commandExit, eventId: item.runnerEvidence.eventId}));
const verification = verifyEvidence({before, after, events, commands});
writeFileSync(join(runDir, 'before.json'), JSON.stringify({schema: 'pr83-v3-full-before', baseCommit: '7a8352242951516a2380e8fc69c5fb902b0c0e5d', entries: before}, null, 2) + '\n');
writeFileSync(join(runDir, 'mapping-plan.json'), JSON.stringify({schema: 'pr83-v3-full-mapping-plan', entries: after.map(item => ({oldEntryIndex: item.oldEntryIndex, oldStableKey: item.oldStableKey, oldFullId: item.oldFullId, plannedFinalCases: [{file: item.finalFile, fullId: item.finalFullId}], classification: item.classification}))}, null, 2) + '\n');
writeFileSync(join(runDir, 'runner-events.json'), JSON.stringify({schema: 'pr83-v3-full-runner-events', commands, events}, null, 2) + '\n');
writeFileSync(join(runDir, 'after.json'), JSON.stringify({schema: 'pr83-v3-full-after', generatedFrom: ['final-source', 'runner-events.json'], entries: after}, null, 2) + '\n');
writeFileSync(join(runDir, 'additional-cases.json'), JSON.stringify({schema: 'pr83-v3-full-additional-cases', entries: additionalCases}, null, 2) + '\n');
writeFileSync(join(runDir, 'precondition-witnesses.json'), JSON.stringify({schema: 'pr83-v3-full-precondition-witnesses', entries: preconditionWitnesses}, null, 2) + '\n');
writeFileSync(join(runDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
writeFileSync(join(runDir, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify({runDir, commands, counts: {oldRows: before.length, afterRows: after.length, events: events.length, additionalCases: additionalCases.length, preconditionWitnesses: preconditionWitnesses.length}, verification}, null, 2));
