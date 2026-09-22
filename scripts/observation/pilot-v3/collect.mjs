import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildAfterEvidence, buildBeforeEvidence, buildPlan, parseAngularReport, parseNodeTap, REPO_ROOT, verifyEvidence} from './oracle.mjs';

const evidenceRoot = '/home/ts/site-development/pr83-ci-test-delivery-evidence/pilot-v3';
mkdirSync(evidenceRoot, {recursive: true});
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
let runDir = join(evidenceRoot, `run-${stamp}`);
let counter = 1;
while (existsSync(runDir)) runDir = join(evidenceRoot, `run-${stamp}-${counter++}`);
mkdirSync(join(runDir, 'raw'), {recursive: true});
const node24 = '/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin/node';
const env = {...process.env, PATH: `/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin:${process.env.PATH ?? ''}`};
const commands = [];
function run(command, args, outputFile) {
  const result = execFileSync(command, args, {cwd: REPO_ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  writeFileSync(join(runDir, 'raw', `${outputFile}.stdout`), result);
  return result;
}
function runCaptured(command, args, outputFile) {
  let status = 0; let stdout = ''; let stderr = '';
  try { stdout = execFileSync(command, args, {cwd: REPO_ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); } catch (error) { status = error.status ?? 1; stdout = error.stdout?.toString() ?? ''; stderr = error.stderr?.toString() ?? ''; }
  writeFileSync(join(runDir, 'raw', `${outputFile}.stdout`), stdout);
  writeFileSync(join(runDir, 'raw', `${outputFile}.stderr`), stderr);
  return {status, stdout, stderr};
}
const angularReport = join(runDir, 'raw/angular-report.json');
const angularArgs = ['pnpm', 'exec', 'ng', 'test', '--watch=false', '--include=src/app/app.component.spec.ts', '--include=src/app/services/notification.service.spec.ts', '--include=src/app/services/notification-lifetime.spec.ts', '--include=src/app/services/notification.service.regression.spec.ts', '--reporters=json', `--output-file=${angularReport}`, '--no-progress'];
const angular = runCaptured('corepack', angularArgs, 'angular');
if (existsSync(angularReport)) writeFileSync(join(runDir, 'angular-report.json'), readFileSync(angularReport));
commands.push({runner: 'angular', command: `PATH=${env.PATH.split(':')[0]}:$PATH corepack ${angularArgs.join(' ')}`, exitCode: angular.status});
const nodeArgs = ['--test', '--test-reporter=tap', 'scripts/performance/recorder.spec.test.mjs'];
const node = runCaptured(node24, nodeArgs, 'node');
writeFileSync(join(runDir, 'node.tap'), node.stdout);
commands.push({runner: 'node-tap', command: `${node24} ${nodeArgs.join(' ')}`, exitCode: node.status});
const beforeMap = JSON.parse(readFileSync('/home/ts/site-development/pr83-ci-test-delivery-evidence/before/observation-map-before.json', 'utf8'));
const beforeTap = readFileSync('/home/ts/site-development/pr83-ci-test-delivery-evidence/before/node-tests-before.tap', 'utf8');
const before = buildBeforeEvidence(beforeMap, beforeTap);
const plan = buildPlan(before);
const events = [
  ...(existsSync(join(runDir, 'angular-report.json')) ? parseAngularReport(JSON.parse(readFileSync(join(runDir, 'angular-report.json'), 'utf8')), commands[0].command) : []),
  ...parseNodeTap(node.stdout, commands[1].command, 'scripts/performance/recorder.spec.test.mjs', node.status),
].map(event => ({...event, commandExit: event.runner === 'angular' ? commands[0].exitCode : commands[1].exitCode}));
const after = buildAfterEvidence(before, plan, events);
const additionalCases = events.filter(event => !after.some(item => item.finalFullId === event.fullId)).map(event => ({...event, classification: 'additional-new-regression'}));
writeFileSync(join(runDir, 'before.json'), JSON.stringify({schema: 'pr83-pilot-v3-before', baseCommit: '7a8352242951516a2380e8fc69c5fb902b0c0e5d', entries: before}, null, 2) + '\n');
writeFileSync(join(runDir, 'mapping-plan.json'), JSON.stringify({schema: 'pr83-pilot-v3-mapping-plan', entries: plan}, null, 2) + '\n');
writeFileSync(join(runDir, 'runner-events.json'), JSON.stringify({schema: 'pr83-pilot-v3-runner-events', commands, events}, null, 2) + '\n');
writeFileSync(join(runDir, 'after.json'), JSON.stringify({schema: 'pr83-pilot-v3-after', generatedFrom: ['final-source', 'runner-events.json'], entries: after}, null, 2) + '\n');
writeFileSync(join(runDir, 'additional-cases.json'), JSON.stringify({schema: 'pr83-pilot-v3-additional-cases', entries: additionalCases}, null, 2) + '\n');
writeFileSync(join(runDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
const verification = verifyEvidence({before, plan, after, events, commandExits: commands});
writeFileSync(join(runDir, 'verification.json'), JSON.stringify({status: 'PASS', verification}, null, 2) + '\n');
console.log(JSON.stringify({runDir, commands, counts: {before: before.length, after: after.length, events: events.length, additionalCases: additionalCases.length}, verification}, null, 2));
