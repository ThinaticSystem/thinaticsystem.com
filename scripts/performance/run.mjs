import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, openSync, closeSync, existsSync, rmSync, realpathSync, cpSync} from 'node:fs';
import {resolve, join, dirname, delimiter, isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import {compileSupervisor, runOwnedCommand} from '../paired-process.mjs';
import {captureSourceIdentity, captureBuildIdentity} from '../paired-identity.mjs';
import {collectInitialAssets} from '../performance-check.mjs';
import {evaluatePerformance} from './contract.mjs';

const baselineSha = '7a8352242951516a2380e8fc69c5fb902b0c0e5d';
const schedule = ['baseline', 'candidate', 'candidate', 'baseline', 'candidate', 'baseline', 'baseline', 'candidate'];
const calibrationSchedule = ['baseline', 'candidate', 'candidate', 'baseline'];
const cwd = process.cwd();
const root = resolve('.artifacts/performance-v3');
mkdirSync(root, {recursive:true});
const directory = mkdtempSync(join(root, 'run-'));
const baselineRoot = resolve(cwd, '..', `performance-v3-${directory.split('/').at(-1)}-baseline`);
const json = (name, value) => writeFileSync(join(directory, name), JSON.stringify(value, null, 2) + '\n');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const git = args => execFileSync('git', args, {cwd, encoding:'utf8', timeout:60_000}).trim();
const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on('SIGTERM', cancel); process.on('SIGINT', cancel);
const env = {...process.env, NG_BUILD_MAX_WORKERS:'2'};
for (const key of Object.keys(env)) if (/^(BROWSER_|EVIDENCE_|PERFORMANCE_|PATRONS_FIXTURE$|DIST_ROOT$|CANDIDATE_SHA$|READINESS_MODULE$|npm_|PNPM_|NODE_PATH$|NODE_OPTIONS$|INIT_CWD$)/.test(key) && key !== 'BROWSER_EXECUTABLE_PATH') delete env[key];
env.PATH = env.PATH.split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter);
let supervisor = null;
let created = false;
let sourceBefore = null;
let headBefore = null;
const outputs = {};
const receipts = {observations:[], calibration:[]};
const observations = [], calibration = [];
const cleanupErrors = [];
const result = {schema:'thinaticsystem/performance-run/v3', directory, verdict:'INVALID_EVIDENCE', cleanup:false, sourceUnchanged:false, absoluteUxAcceptance:'NOT_ESTABLISHED', baselineSha};

/** Run one child under the existing bounded subreaper and persist raw exit before admission. */
async function command(name, executable, args, options = {}) {
  if (cancellation.signal.aborted) throw new Error('Cancelled');
  const stdout = openSync(join(directory, name + '.stdout.log'), 'wx');
  const stderr = openSync(join(directory, name + '.stderr.log'), 'wx');
  const temporary = mkdtempSync('/tmp/thinatic-perf-');
  try {
    const receipt = await runOwnedCommand(executable, args, {supervisor,receiptPath:join(directory,name+'.supervision.json'),cwd:options.cwd??cwd,env:{...env,...options.env,TMPDIR:temporary},stdout,stderr,timeoutInMs:options.timeoutInMs??300_000,signal:cancellation.signal});
    receipt.stderr = readFileSync(join(directory, name + '.stderr.log'), 'utf8');
    json(name + '.exit.json', receipt);
    cleanupErrors.push(...receipt.cleanupErrors);
    if (receipt.status !== 0 || receipt.signal !== null || receipt.error !== null || receipt.timedOut || receipt.interrupted || !receipt.cleanup || (options.strictStderr && receipt.stderr !== '')) throw new Error(name + ': invalid process outcome; see raw receipt');
    return receipt;
  } finally {
    closeSync(stdout); closeSync(stderr);
    // SAFETY: the subreaper must have verified descendants gone before removing its temporary root.
    if (cleanupErrors.length === 0) rmSync(temporary, {recursive:true, force:true});
  }
}

console.log('Performance v3 evidence: ' + directory);
try {
  sourceBefore = captureSourceIdentity(cwd); headBefore = git(['rev-parse','HEAD']);
  json('source-before.json', sourceBefore);
  if (process.version !== 'v' + readFileSync('.node-version','utf8').trim()) throw new Error('Candidate Node pin mismatch');
  const policy = JSON.parse(readFileSync('scripts/performance/fixtures/performance-policy-v3.json','utf8'));
  json('policy.json', policy);
  json('identity.json', {head:headBefore,sourceSha256:sourceBefore.sha256,policySha256:hash('scripts/performance/fixtures/performance-policy-v3.json'),node:process.version,execPath:process.execPath,host:hostname(),schedule,calibrationSchedule,github:{sha:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null}});
  supervisor = compileSupervisor(directory);
  const baselineNode = process.env.BASELINE_NODE_EXECUTABLE;
  if (!baselineNode || !isAbsolute(baselineNode)) throw new Error('Absolute BASELINE_NODE_EXECUTABLE required');
  const baselineEnv = {...env,PATH:dirname(baselineNode)+delimiter+env.PATH,COREPACK_DEFAULT_TO_LATEST:'0'};
  const corepack = realpathSync(join(dirname(baselineNode),'corepack'));
  if (git(['rev-parse',baselineSha+'^{commit}']) !== baselineSha || existsSync(baselineRoot)) throw new Error('Baseline object absent or worktree path occupied');
  created = true;
  await command('baseline-worktree', 'git', ['worktree','add','--detach',baselineRoot,baselineSha]);
  await command('baseline-runtime', baselineNode, ['-e','console.log(process.version)'], {env:baselineEnv,strictStderr:true});
  if (readFileSync(join(directory,'baseline-runtime.stdout.log'),'utf8').trim() !== 'v'+readFileSync('.baseline-node-version','utf8').trim()) throw new Error('Historical Node pin mismatch');
  const baselinePackage = JSON.parse(readFileSync(join(baselineRoot,'package.json'),'utf8'));
  if (!baselinePackage.packageManager.startsWith('pnpm@9.10.0+')) throw new Error('Historical pnpm pin mismatch');
  const lockBefore = hash(join(baselineRoot,'pnpm-lock.yaml'));
  await command('baseline-install',baselineNode,[corepack,'pnpm','install','--frozen-lockfile','--package-import-method=copy','--reporter=append-only'],{cwd:baselineRoot,env:baselineEnv,timeoutInMs:480_000});
  await command('baseline-build',baselineNode,[corepack,'pnpm','run','build'],{cwd:baselineRoot,env:baselineEnv});
  if (hash(join(baselineRoot,'pnpm-lock.yaml')) !== lockBefore) throw new Error('Historical lock changed');
  await command('candidate-build','corepack',['pnpm','run','build']);
  const retainedBaseline = join(directory, 'baseline-browser');
  const baselineOutputIdentity = captureBuildIdentity(join(baselineRoot, 'dist/app'));
  cpSync(join(baselineRoot, 'dist/app'), retainedBaseline, {recursive:true, errorOnExist:true, force:false});
  if (!isDeepStrictEqual(baselineOutputIdentity, captureBuildIdentity(retainedBaseline))) throw new Error('Retained baseline build differs');
  for (const [side,path] of [['baseline',retainedBaseline],['candidate',resolve('dist/app/browser')]]) {
    outputs[side] = {path,identity:captureBuildIdentity(path)};
    json(side+'-output.json',outputs[side].identity);
  }
  if (captureSourceIdentity(cwd).sha256 !== sourceBefore.sha256) throw new Error('Source changed during build');
  const staticAssets = side => ({initial:collectInitialAssets(outputs[side].path).total,
    allEmittedJsCssRawBytes:outputs[side].identity.files.filter(file=>/\.(js|css)$/.test(file.path)).reduce((sum,file)=>sum+file.sizeInBytes,0)});
  // NOTE: Same process/compressor inventories include unvisited lazy output.
  const assets = {...staticAssets('candidate'), baseline:staticAssets('baseline')};
  json('assets.json',assets);
  const collect = async (group, side, ordinal, buildSide) => {
    const name = group+'-'+ordinal+'-'+side;
    const outputDirectory = join(directory,name);
    const receipt = await command(name,process.execPath,['scripts/performance/collector.mjs','--dist',outputs[buildSide].path,'--output',outputDirectory,'--side',side,'--ordinal',String(ordinal)],{strictStderr:true,timeoutInMs:180_000});
    const observation = JSON.parse(readFileSync(join(outputDirectory,'observation.json'),'utf8'));
    if (!Array.isArray(observation.journeys) || observation.journeys.some(journey => !journey.pageClock || !journey.readinessWitness || (journey.id === 'desktop.theme-toggle' && !journey.readinessWitness.theme))) throw new Error('Raw page clock/readiness witness missing: '+name);
    if (observation.side !== side || observation.attemptOrdinal !== ordinal || observation.buildSha256 !== outputs[buildSide].identity.sha256) throw new Error('Observation/source binding mismatch: '+name);
    receipts[group].push({side,attemptOrdinal:ordinal,status:receipt.status,signal:receipt.signal,timedOut:receipt.timedOut,cleanup:receipt.cleanup,stderr:receipt.stderr,runtime:process.version});
    (group==='calibration'?calibration:observations).push(observation);
    json('observations.json',observations);json('calibration.json',calibration);json('receipts.json',receipts);
    console.log(name+': retained');
  };
  for (const [index,side] of calibrationSchedule.entries()) await collect('calibration',side,index,'candidate');
  for (const [index,side] of schedule.entries()) await collect('observations',side,index,side);
  const evaluation = evaluatePerformance({observations,calibration,assets,policy,receipts});
  json('evaluation.json',evaluation);
  result.evaluation = evaluation; result.verdict = evaluation.verdict;
  if (!['PASS','PASS_WITH_NOTES'].includes(evaluation.verdict)) process.exitCode = 1;
} catch (error) {
  result.error = error.stack ?? String(error); result.verdict = 'INVALID_EVIDENCE'; process.exitCode = 1;
} finally {
  try {
    const sourceAfter = captureSourceIdentity(cwd);json('source-after.json',sourceAfter);
    result.sourceUnchanged = sourceBefore !== null && isDeepStrictEqual(sourceBefore,sourceAfter) && git(['rev-parse','HEAD']) === headBefore;
    if (!result.sourceUnchanged) throw new Error('Source/HEAD changed during measurement');
    for (const [side,{path,identity}] of Object.entries(outputs)) {
      const after = captureBuildIdentity(path);json(side+'-output-after.json',after);
      if (!isDeepStrictEqual(identity,after)) throw new Error(side+' output changed during measurement');
    }
  } catch (error) {result.identityError=error.message;result.verdict='INVALID_EVIDENCE';process.exitCode=1;}
  if (created) {
    try {
      if (git(['worktree','list','--porcelain']).split('\n').includes('worktree '+baselineRoot)) execFileSync('git',['worktree','remove','--force',baselineRoot],{cwd,timeout:60_000});
      else rmSync(baselineRoot,{recursive:true,force:true});
    } catch(error) {cleanupErrors.push(error.message);}
  }
  result.cleanup = !existsSync(baselineRoot) && cleanupErrors.length === 0;
  result.cleanupErrors=cleanupErrors;
  if (!result.cleanup) {result.verdict='INVALID_EVIDENCE';process.exitCode=1;}
  json('result.json',result);
  console.log(JSON.stringify(result,null,2));
  process.off('SIGTERM',cancel);process.off('SIGINT',cancel);
}
