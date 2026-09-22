import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildBeforeEvidence, buildEvents, buildMapping, buildRegistry, loadBeforeTap, loadObservationMap, normalizedProjection, verifyEvidence, REPO_ROOT, filesAtCommit} from './oracle.mjs';

const evidenceRoot = '/home/ts/site-development/pr83-ci-test-delivery-evidence/v3-full';
mkdirSync(evidenceRoot, {recursive: true});
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
let runDir = join(evidenceRoot, `run-${stamp}`);
let suffix = 1;
while (existsSync(runDir)) runDir = join(evidenceRoot, `run-${stamp}-${suffix++}`);
mkdirSync(join(runDir, 'raw'), {recursive: true});
const nodePath = '/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin/node';
const env = {...process.env, PATH: `/nix/store/lfaydgacdyngci7p60s8wwvgdm74fjkx-nodejs-24.19.0/bin:/run/current-system/sw/bin`};
const candidateCommit = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO_ROOT, env, encoding: 'utf8'}).stdout.trim();

function run(command, args, outputName, cwd = REPO_ROOT) {
  const result = spawnSync(command, args, {cwd, env, encoding: 'utf8'});
  writeFileSync(join(runDir, 'raw', `${outputName}.stdout`), result.stdout ?? '');
  writeFileSync(join(runDir, 'raw', `${outputName}.stderr`), result.stderr ?? '');
  return {status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? ''};
}

const angularReport = join(runDir, 'raw', 'angular-report.json');
const angularArgs = ['pnpm', 'exec', 'ng', 'test', '--watch=false', '--no-progress', '--reporters=json', `--output-file=${angularReport}`];
const angular = run('corepack', angularArgs, 'angular');
if (!existsSync(angularReport)) throw new Error(`Angular JSON report was not produced (exit ${angular.status})`);
writeFileSync(join(runDir, 'angular-report.json'), readFileSync(angularReport));
const baseRoot = join(runDir, 'base-source');
mkdirSync(baseRoot, {recursive: true});
const baseArchive = spawnSync('git', ['archive', '7a8352242951516a2380e8fc69c5fb902b0c0e5d'], {cwd: REPO_ROOT, env, maxBuffer: 128 * 1024 * 1024});
if (baseArchive.status !== 0) throw new Error(`base source archive failed: ${baseArchive.stderr}`);
const baseTar = join(runDir, 'raw', 'base-source.tar');
writeFileSync(baseTar, baseArchive.stdout);
const extract = spawnSync('tar', ['-xf', baseTar, '-C', baseRoot], {cwd: REPO_ROOT, env, encoding: 'utf8'});
if (extract.status !== 0) throw new Error(`base source extraction failed: ${extract.stderr}`);
if (existsSync(join(REPO_ROOT, 'node_modules'))) symlinkSync(join(REPO_ROOT, 'node_modules'), join(baseRoot, 'node_modules'), 'dir');
const reporterPath = join(REPO_ROOT, 'scripts/observation/v3-full/reporter.mjs');
mkdirSync(join(baseRoot, 'scripts/observation/v3-full'), {recursive: true});
writeFileSync(join(baseRoot, 'scripts/observation/v3-full/reporter.mjs'), readFileSync(reporterPath));
const baseNodeFiles = filesAtCommit('7a8352242951516a2380e8fc69c5fb902b0c0e5d').filter(file => file.endsWith('.spec.test.mjs') || file.endsWith('.test.mjs'));
const baseNodeArgs = ['--test', '--test-reporter=./scripts/observation/v3-full/reporter.mjs', ...baseNodeFiles];
const baseNode = run(nodePath, baseNodeArgs, 'base-node-reporter', baseRoot);
writeFileSync(join(runDir, 'base-node-reporter.ndjson'), baseNode.stdout);
const nodeFiles = filesAtCommit(null).filter(file => file.endsWith('.spec.test.mjs') || file.endsWith('.test.mjs'));
const nodeArgs = ['--test', '--test-reporter=./scripts/observation/v3-full/reporter.mjs', ...nodeFiles];
const node = run(nodePath, nodeArgs, 'node-reporter');
writeFileSync(join(runDir, 'node-reporter.ndjson'), node.stdout);
const commands = {
  angular: {runner: 'angular', command: `PATH=${env.PATH} corepack ${angularArgs.join(' ')}`, exitCode: angular.status},
  baseNode: {runner: 'node-tap', command: `${nodePath} ${baseNodeArgs.join(' ')}`, exitCode: baseNode.status},
  node: {runner: 'node-tap', command: `${nodePath} ${nodeArgs.join(' ')}`, exitCode: node.status},
};
const baseRegistry = buildRegistry('7a8352242951516a2380e8fc69c5fb902b0c0e5d');
const currentRegistry = buildRegistry(null);
const before = buildBeforeEvidence(loadObservationMap(), baseRegistry, loadBeforeTap(), baseNode.stdout, currentRegistry);
const events = buildEvents(JSON.parse(readFileSync(join(runDir, 'angular-report.json'), 'utf8')), node.stdout, currentRegistry, commands);
const mapping = buildMapping(before, events);
const after = mapping.after;
const planned = new Set(after.map(item => `${item.runnerEvidence.runner}\u0000${item.finalFile}\u0000${item.finalFullId}`));
const additionalCases = events.filter(event => !planned.has(`${event.runner}\u0000${event.file}\u0000${event.fullId}`)).map(event => ({...event, classification: event.file.includes('.regression.') ? 'additional-new-regression' : 'additional-final-case'}));
const preconditionWitnesses = after.filter(item => item.status === 'PRECONDITION_PRESERVED').map(item => ({oldEntryIndex: item.oldEntryIndex, oldFullId: item.oldFullId, status: item.status, commandExit: item.runnerEvidence.commandExit, eventId: item.runnerEvidence.eventId}));
const verification = verifyEvidence({before, after, events, commands});
const correctedFamilyFiles = ['scripts/functional-budget-contract.spec.test.mjs', 'scripts/functional-budget-evidence.spec.test.mjs', 'scripts/paired-continuation.spec.test.mjs', 'scripts/paired-performance-contract.spec.test.mjs'];
const correctedFamilies = correctedFamilyFiles.map(finalFile => {
  const rows = after.filter(item => item.finalFile === finalFile);
  return {finalFile, oldIndices: rows.map(item => item.oldEntryIndex), count: rows.length, pass: rows.filter(item => item.status === 'PASS').length, reporterBound: rows.every(item => item.mappingResolution === 'source-file-line-column-reporter')};
});
const ownershipFalseIndices = [598, 599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612, 613, 638, 639, 640, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695];
if (ownershipFalseIndices.length !== 57) throw new Error(`ownership correction index count mismatch: ${ownershipFalseIndices.length}`);
const ownershipCorrection = {schema: 'pr83-v3-full-ownership-correction', decision: 'CHANGES_REQUIRED_SOURCE_FAMILY_CORRECTED', candidateCommit, immutableOldMap: '/home/ts/site-development/pr83-ci-test-delivery-evidence/before/observation-map-before.json', immutableOldTap: '/home/ts/site-development/pr83-ci-test-delivery-evidence/before/node-tests-before.tap', baseReporterCommand: commands.baseNode.command, finalReporterCommand: commands.node.command, method: 'Node24 custom reporter emitted file/line/column/title/status; each base file sequence was uniquely reconciled to the preserved aggregate TAP before mapping old rows.', correctedFamilies, falseOwnership: {count: ownershipFalseIndices.length, oldIndices: ownershipFalseIndices, finalState: 'Existing source files execute these rows once; no product-test movement or duplication was performed.'}, verification: {status: verification.status, oldRows: verification.oldRows, mappedRows: verification.afterRows, actualEvents: verification.identities.actualUnique, manualReviewRows: verification.manualReview}};
writeFileSync(join(runDir, 'ownership-correction.json'), JSON.stringify(ownershipCorrection, null, 2) + '\n');
writeFileSync(join(runDir, 'before.json'), JSON.stringify({schema: 'pr83-v3-full-before', baseCommit: '7a8352242951516a2380e8fc69c5fb902b0c0e5d', entries: before}, null, 2) + '\n');
writeFileSync(join(runDir, 'mapping-plan.json'), JSON.stringify({schema: 'pr83-v3-full-mapping-plan', entries: after.map(item => ({oldEntryIndex: item.oldEntryIndex, oldStableKey: item.oldStableKey, oldFullId: item.oldFullId, plannedFinalCases: [{file: item.finalFile, fullId: item.finalFullId}], classification: item.classification}))}, null, 2) + '\n');
writeFileSync(join(runDir, 'runner-events.json'), JSON.stringify({schema: 'pr83-v3-full-runner-events', commands, events}, null, 2) + '\n');
writeFileSync(join(runDir, 'after.json'), JSON.stringify({schema: 'pr83-v3-full-after', generatedFrom: ['final-source', 'runner-events.json'], entries: after}, null, 2) + '\n');
const projectionText = JSON.stringify({schema: 'pr83-v3-full-normalized-projection', entries: normalizedProjection(after)}, null, 2) + '\n';
writeFileSync(join(runDir, 'normalized-projection.json'), projectionText);
const projectionSha256 = createHash('sha256').update(projectionText).digest('hex');
writeFileSync(join(runDir, 'additional-cases.json'), JSON.stringify({schema: 'pr83-v3-full-additional-cases', entries: additionalCases}, null, 2) + '\n');
writeFileSync(join(runDir, 'precondition-witnesses.json'), JSON.stringify({schema: 'pr83-v3-full-precondition-witnesses', entries: preconditionWitnesses}, null, 2) + '\n');
writeFileSync(join(runDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
writeFileSync(join(runDir, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify({runDir, commands, counts: {oldRows: before.length, afterRows: after.length, events: events.length, additionalCases: additionalCases.length, preconditionWitnesses: preconditionWitnesses.length}, projectionSha256, verification}, null, 2));
