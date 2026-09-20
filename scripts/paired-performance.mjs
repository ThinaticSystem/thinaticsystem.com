import {readHistoricalControl, validateControlRuntime, validateMeasurementControl} from './paired-baseline-control.mjs';
import {captureSourceIdentity, captureBuildIdentity} from './paired-identity.mjs';
import {parseArgs, isDeepStrictEqual} from 'node:util';
import {compileSupervisor, runOwnedCommand} from './paired-process.mjs';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, openSync, closeSync, existsSync, rmSync, realpathSync} from 'node:fs';
import {resolve, join, basename, delimiter, dirname, isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {hostname, platform, release, arch, cpus} from 'node:os';
import {baselineSha, schedule, policy, validateAttempt, combineAttempts} from './paired-performance-contract.mjs';
import {collectInitialAssets} from './performance-check.mjs';

const cwd = process.cwd();
const root = resolve('.artifacts/paired-ci');
mkdirSync(root, {recursive: true});
const directory = mkdtempSync(join(root, 'run-'));
// COMPAT: keep Angular 18 outside the Angular 22 ancestor/module lookup tree.
const worktree = resolve(cwd, '..', `${basename(directory)}-paired-baseline`);
const json = (name, data) => writeFileSync(join(directory, name), `${JSON.stringify(data, null, 2)}\n`);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const git = args => execFileSync('git', args, {encoding: 'utf8', timeout: 30_000}).trim();
const env = {...process.env, NG_BUILD_MAX_WORKERS: '2'};
// SAFETY: measurement controls cannot inherit a caller's previous baseline/fixtures/output.
for (const key of Object.keys(env)) if (/^(BROWSER_|EVIDENCE_|PERFORMANCE_|PATRONS_FIXTURE$|DIST_ROOT$|CANDIDATE_SHA$|READINESS_MODULE$)/.test(key) && key !== 'BROWSER_EXECUTABLE_PATH') delete env[key];
// COMPAT: pnpm run exports candidate-specific paths/config; do not pass these into the old build.
for (const key of Object.keys(env)) if (/^(npm_|PNPM_|NODE_PATH$|NODE_OPTIONS$|INIT_CWD$)/.test(key)) delete env[key];
env.PATH = env.PATH.split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter);
const cancellation = new AbortController();
let supervisor = null;
let interrupted = false;
let cleanupErrors = [];
const interrupt = () => { interrupted = true; cancellation.abort(); };
process.on('SIGTERM', interrupt);
process.on('SIGINT', interrupt);

/** Preserve raw outcome only after the owner has reaped every descendant. */
async function command(name, executable, args, options = {}) {
  if (interrupted) throw new Error('Run cancelled');
  const out = openSync(join(directory, name + '.stdout.log'), 'wx');
  const err = openSync(join(directory, name + '.stderr.log'), 'wx');
  // COMPAT: Chromium singleton AF_UNIX socket paths must fit Linux's 108-byte limit.
  // Each mode0700 directory is owned by this stage and removed only after reaping.
  const temporary = mkdtempSync('/tmp/thinatic-paired-');
  const startedAt = new Date().toISOString();
  try {
    const receipt = {...await runOwnedCommand(executable, args, {supervisor, receiptPath:join(directory,name+'.supervision.json'), cwd:options.cwd ?? cwd, env:{...env,...options.env,TMPDIR:temporary}, stdout:out, stderr:err, timeoutInMs:options.timeoutInMs ?? 300_000, signal:cancellation.signal}), startedAt, finishedAt:new Date().toISOString(), executable, args, cwd:options.cwd ?? cwd};
    cleanupErrors.push(...receipt.cleanupErrors);
    receipt.stderr = readFileSync(join(directory, name + '.stderr.log'), 'utf8');
    json(name + '.exit.json', receipt);
    if (!receipt.cleanup || receipt.interrupted || interrupted || (!options.browser && (receipt.status !== 0 || receipt.signal || receipt.error || receipt.timedOut))) throw new Error(name + ' failed: see raw receipt');
    return receipt;
  } finally { closeSync(out); closeSync(err); rmSync(temporary, {recursive:true,force:true}); }
}

let created = false;
let sourceBefore = null;
let identity = null;
const buildIdentities = {};
const capture = (side, path) => {
 const output = captureBuildIdentity(path);
 buildIdentities[side] = {path, output};
 json(side + '-output-identity.json', output);
};
const result = {verdict: 'FAIL', directory, baseSha: baselineSha, attempts: [], cleanup: false};
console.log(`Paired evidence: ${directory}`);
try {
  sourceBefore = captureSourceIdentity(cwd);
  json('source-before.json', sourceBefore);
  if (process.version !== 'v' + readFileSync('.node-version', 'utf8').trim()) throw new Error('Use exact candidate measurement runtime from .node-version');
  const {values} = parseArgs({options: {'baseline-control': {type:'string'}, 'baseline-control-sha256': {type:'string'}}});
  const selection = {path:values['baseline-control'], sha256:values['baseline-control-sha256']};
  const debt = readHistoricalControl(selection);
  if ('v' + readFileSync('.baseline-node-version','utf8').trim() !== debt.baseline.node) throw new Error('Baseline runtime pin changed');
  const baselineNode = process.env.BASELINE_NODE_EXECUTABLE;
  if (!baselineNode || !isAbsolute(baselineNode)) throw new Error('Absolute BASELINE_NODE_EXECUTABLE required from Nix/setup-node');
  const baselineCorepack = realpathSync(join(dirname(baselineNode), 'corepack'));
  const baselineEnv = {...env, PATH:dirname(baselineNode) + delimiter + env.PATH, COREPACK_DEFAULT_TO_LATEST:'0'};
  const baselineCommand = (name,args,options={}) => command(name,baselineNode,[baselineCorepack,...args],{cwd:worktree,...options,env:baselineEnv});
  try { supervisor = compileSupervisor(directory); }
  catch (error) { cleanupErrors.push('Compiler bootstrap failed; descendant cleanup unverified'); throw error; }
  if (git(['rev-parse', `${baselineSha}^{commit}`]) !== baselineSha) throw new Error('Fixed baseline object missing; checkout full history');
  identity = {baseSha:baselineSha,candidateHead:git(['rev-parse','HEAD']),candidateStatus:git(['status','--short']),source:sourceBefore,control:selection,supervisor:{binarySha256:hash(supervisor),compiler:execFileSync('cc',['--version'],{encoding:'utf8',timeout:5_000}).split('\n')[0]},node:process.version,execPath:process.execPath,packageManager:JSON.parse(readFileSync('package.json')).packageManager,playwright:JSON.parse(readFileSync('node_modules/playwright/package.json')).version,host:hostname(),platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model,github:{runId:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null,sha:process.env.GITHUB_SHA??null},schedule,policy};
  json('identity.json', identity);
  writeFileSync(join(directory, 'candidate.patch'), execFileSync('git', ['diff', '--binary']));
  if (existsSync(worktree)) throw new Error('Refusing pre-existing worktree path');
  created = true; // Own the absent unique path before checkout can be interrupted.
  await command('baseline-worktree-add', 'git', ['worktree', 'add', '--detach', worktree, baselineSha]);
  const basePackage = JSON.parse(readFileSync(join(worktree, 'package.json')));
  if (!basePackage.packageManager.startsWith('pnpm@9.10.0+')) throw new Error('Unexpected baseline package manager');
  await command('baseline-node',baselineNode,['-e','console.log(JSON.stringify({node:process.version,execPath:process.execPath}))'],{cwd:worktree,env:baselineEnv});
  await baselineCommand('baseline-corepack',['--version']);
  await baselineCommand('baseline-pnpm',['pnpm','--version']);
  const runtime = {...JSON.parse(readFileSync(join(directory,'baseline-node.stdout.log'),'utf8')),expectedExecPath:realpathSync(baselineNode),corepack:readFileSync(join(directory,'baseline-corepack.stdout.log'),'utf8').trim(),pnpm:readFileSync(join(directory,'baseline-pnpm.stdout.log'),'utf8').trim(),lockSha256:hash(join(worktree,'pnpm-lock.yaml'))};
  json('baseline-build-identity.json',{sha:baselineSha,...runtime,corepackExecutable:baselineCorepack,packageManager:basePackage.packageManager,angularConfigSha256:hash(join(worktree,'angular.json'))});
  const runtimeErrors=validateControlRuntime(debt,runtime);
  for(const name of ['baseline-node','baseline-corepack','baseline-pnpm']) if(readFileSync(join(directory,name+'.stderr.log'),'utf8')!=='') runtimeErrors.push(name+' unexpected stderr');
  if(runtimeErrors.length) throw new Error(runtimeErrors.join('; '));
  await baselineCommand('baseline-install',['pnpm','install','--frozen-lockfile','--reporter=append-only'],{timeoutInMs:480_000});
  await baselineCommand('baseline-toolchain',['pnpm','exec','ng','version']);
  if(/unsupported|not supported/i.test(readFileSync(join(directory,'baseline-toolchain.stdout.log'),'utf8')+readFileSync(join(directory,'baseline-toolchain.stderr.log'),'utf8'))) throw new Error('Unsupported baseline toolchain');
  await baselineCommand('baseline-build',['pnpm','run','build']);
  if(hash(join(worktree,'pnpm-lock.yaml'))!==runtime.lockSha256) throw new Error('Baseline lock changed during install/build');
  capture('baseline',join(worktree,'dist/app'));
  await command('candidate-pnpm','corepack',['pnpm','--version']);
  const candidatePnpm=readFileSync(join(directory,'candidate-pnpm.stdout.log'),'utf8').trim();
  if(candidatePnpm!==identity.packageManager.match(/^pnpm@([^+]+)/)?.[1]) throw new Error('Candidate package manager mismatch');
  await command('candidate-install', 'corepack', ['pnpm', 'install', '--frozen-lockfile', '--reporter=append-only'], {timeoutInMs:480_000});
  await command('candidate-toolchain', 'corepack', ['pnpm', 'exec', 'ng', 'version']);
  await command('candidate-build', 'corepack', ['pnpm', 'run', 'build']);
  capture('candidate',resolve('dist/app/browser'));
  json('candidate-build-identity.json',{sourceSha256:sourceBefore.sha256,node:process.version,execPath:process.execPath,packageManager:identity.packageManager,pnpm:candidatePnpm,lockSha256:hash('pnpm-lock.yaml'),outputSha256:buildIdentities.candidate.output.sha256});
  if(captureSourceIdentity(cwd).sha256!==sourceBefore.sha256) throw new Error('Source changed during frozen installs/builds');
  await command('browser-contract', process.execPath, ['scripts/verify-browser-readiness.mjs'], {timeoutInMs: 90_000});
  const observations = {baseline: [], candidate: []};
  let browser = null;
  for (const [index, side] of schedule.entries()) {
    const name = `${index + 1}-${side}`;
    const evidenceDir = join(directory, name);
    mkdirSync(evidenceDir);
    const evidencePath = join(evidenceDir, 'browser.json');
    const receipt = await command(name, process.execPath, ['scripts/browser-smoke.mjs'], {browser: true, timeoutInMs: 120_000, env: {DIST_ROOT: side === 'baseline' ? join(worktree, 'dist/app') : resolve('dist/app/browser'), BROWSER_BASE_URL: 'http://127.0.0.1:4174', BROWSER_REPEATS: '1', PATRONS_FIXTURE: resolve('test/fixtures/patrons.json'), EVIDENCE_DIR: evidenceDir, EVIDENCE_OUTPUT: evidencePath}});
    const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath)) : null;
    const errors = [...validateAttempt({side, receipt, evidence, debt, browser}), ...validateMeasurementControl(debt,evidence)];
    for(const scan of evidence?.runs?.[0]?.a11y ?? []) {
      const diagnostic=scan.diagnostics;
      if(!diagnostic || diagnostic.file!== 'axe-'+scan.name+'-repeat-1.json' || !existsSync(join(evidenceDir,diagnostic.file)) || hash(join(evidenceDir,diagnostic.file))!==diagnostic.sha256) errors.push('Missing/changed raw axe diagnostic');
      else {
        const raw=JSON.parse(readFileSync(join(evidenceDir,diagnostic.file)));
        if(raw.testEngine?.version!==debt.measurement.axe || !Array.isArray(raw.incomplete) || !Array.isArray(raw.passes) || !isDeepStrictEqual(raw.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),scan.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})))) errors.push('Raw axe diagnostic identity mismatch');
      }
    }
    result.attempts.push({name, side, status: receipt.status, validationErrors: errors, productVerdict: side === 'baseline' ? 'KNOWN_BASELINE_FAILURE_NOT_PRODUCT_PASS' : receipt.status === 0 ? 'PASS' : 'FAIL'});
    json('result.json', result);
    if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
    browser ??= evidence.browser;
    observations[side].push(evidence);
    console.log(`${name}: complete (${side === 'baseline' ? 'known baseline defects retained' : 'candidate clean'})`);
  }
  if(captureSourceIdentity(cwd).sha256!==sourceBefore.sha256) throw new Error('Source changed during measurements');
  const base = combineAttempts(observations.baseline);
  const candidate = combineAttempts(observations.candidate);
  const fresh = {baseSha: baselineSha, schema: base.schema, browser: base.browser, timingSubstrate: base.timingSubstrate, initial: collectInitialAssets(join(worktree, 'dist/app')).total, policy, journeys: Object.fromEntries(Object.entries(base.aggregate.journeys).map(([name, j]) => [name, {medianInMs: j.medianInMs, requestCount: Math.max(...j.requestCounts)}])), routeResources: Object.fromEntries(Object.entries(base.aggregate.journeys).map(([name, j]) => [name, {rawBytes: Math.max(...j.resourceSummaries.map(r => r.decodedBodySizeInBytes)), requestCount: Math.max(...j.resourceSummaries.map(r => r.count))}]))};
  json('baseline-browser.json', base); json('baseline.json', fresh); json('candidate.json', candidate);
  await command('performance', process.execPath, ['scripts/performance-check.mjs'], {env: {DIST_ROOT: resolve('dist/app/browser'), PERFORMANCE_BASELINE: join(directory, 'baseline.json'), EVIDENCE_OUTPUT: join(directory, 'candidate.json'), PERFORMANCE_OUTPUT: join(directory, 'performance.json'), CANDIDATE_SHA: identity.candidateHead}});
  result.verdict = 'PASS_PAIRED_PERFORMANCE_ONLY';
} catch (error) {
  result.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  // SAFETY: identity is verified even after install, browser, comparison failure or cancellation.
  try {
    const sourceAfter=captureSourceIdentity(cwd);
    json('source-after.json',sourceAfter);
    result.sourceUnchanged=sourceBefore!==null && isDeepStrictEqual(sourceAfter,sourceBefore);
    result.sourceSha256=sourceBefore?.sha256 ?? null;
    result.candidateHeadAfter=git(['rev-parse','HEAD']);
    if(identity && result.candidateHeadAfter!==identity.candidateHead) throw new Error('Candidate HEAD changed during run');
    if(!result.sourceUnchanged) throw new Error('Source manifest changed or was not captured');
    for(const [side,{path,output}] of Object.entries(buildIdentities)) {
      const after=captureBuildIdentity(path);json(side+'-output-after.json',after);
      if(!isDeepStrictEqual(after,output)) throw new Error(side+' build output changed after measurement');
    }
  } catch(error) {result.identityError=error.message;result.verdict='FAIL';process.exitCode=1;}
  // SAFETY: only this invocation's worktree is removed; never touch existing baseline worktrees.
  if (created) {
    try {
      const registered = git(['worktree', 'list', '--porcelain']).split('\n').includes(`worktree ${worktree}`);
      if (registered) execFileSync('git', ['worktree', 'remove', '--force', worktree], {timeout: 60_000});
      else rmSync(worktree, {recursive: true, force: true});
      result.cleanup = !existsSync(worktree) && cleanupErrors.length === 0;
      if (!result.cleanup) throw new Error('Incomplete process/worktree cleanup');
    }
    catch (error) { result.cleanupError = error.message; result.verdict = 'FAIL'; process.exitCode = 1; }
  } else result.cleanup = !existsSync(worktree) && cleanupErrors.length === 0;
  json('result.json', result);
  console.log(JSON.stringify(result, null, 2));
  process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt);
}
