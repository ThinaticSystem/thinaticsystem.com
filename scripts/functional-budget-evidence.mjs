import {readFileSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {captureSourceIdentity} from './paired-identity.mjs';
import {readHistoricalControl,controlSelection,validateControlRuntime} from './paired-baseline-control.mjs';
import {baselineSha,schedule,policy as historicalPolicy,validateAttempt,combineAttempts,journeyNames} from './paired-performance-contract.mjs';
import {collectBudgetAssets,validateApplicationBoundary} from './functional-budget-assets.mjs';
import {evaluateFunctionalBudget} from './functional-budget-contract.mjs';

export const budgetSelection=Object.freeze({path:'test/functional-budget-v1.json',sha256:'564117dd0befb9f5cc08d932a5b5f4a94785852bc359e1b8ae261a0ec5591fd0'});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};
function bytes(path) {
 const stat=lstatSync(path);
 requireValue(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=16_777_216,'Invalid/missing/oversized regular evidence file: '+path);
 return readFileSync(path);
}
const readJson=path=>JSON.parse(bytes(path));

/** A FAIL is usable data only after normal command exit and verified descendant cleanup. */
export function validateBudgetReceipt(receipt,supervision,status) {
 const errors=[];
 if(receipt?.status!==status||receipt.signal!==null||receipt.error!==null||receipt.timedOut!==false||receipt.interrupted!==false||receipt.cleanup!==true||!isDeepStrictEqual(receipt.cleanupErrors,[])||!isDeepStrictEqual(receipt.supervisor,{status:0,signal:null})) errors.push('Invalid command outcome/cleanup');
 if(!isDeepStrictEqual(supervision,{schema:1,status,signal:null,timedOut:false,interrupted:0,spawnErrno:0,cleanup:true,cleanupErrno:0})) errors.push('Invalid raw supervision receipt');
 return errors;
}

/** Reconstruct the unchanged comparator's exact failure set; unknown/mixed failures cannot be waived. */
export function historicalRegressions(baseline,candidate,initial) {
 const failures=[];
 for(const [name,expected] of Object.entries(baseline.journeys)) {
  const observed=candidate.aggregate.journeys[name];
  if(observed.requestCounts.some(count=>count>expected.requestCount)) failures.push(`Request count regression in ${name}: ${JSON.stringify(observed.requestCounts)} > ${expected.requestCount}`);
  const threshold=baseline.policy.timing.maxRelativeRegression;
  if(!Number.isFinite(observed.medianInMs)||observed.medianInMs>expected.medianInMs*(1+threshold)) failures.push(`Timing regression or inconclusive measurement in ${name}: median ${observed.medianInMs}ms > ${expected.medianInMs}ms baseline by more than ${threshold*100}%.`);
  const expectedResources=baseline.routeResources[name];
  if(observed.resourceSummaries.some(row=>row.decodedBodySizeInBytes>expectedResources.rawBytes||row.count>expectedResources.requestCount)) failures.push(`Lazy-route resource regression in ${name}: observed ${JSON.stringify(observed.resourceSummaries)} > ${JSON.stringify(expectedResources)}`);
 }
 for(const key of ['rawBytes','gzipBytes','brotliBytes']) if(initial[key]>baseline.initial[key]) failures.push(`Initial ${key} regression: ${initial[key]} > ${baseline.initial[key]}`);
 return failures;
}

/** Read one complete fixed paired run, bind it to current source/build, then evaluate the approved policy.
 * Throws on corrupt/incomplete evidence; the CLI persists INVALID_EVIDENCE. No build, browser, or old-file write occurs here.
 */
export function inspectFunctionalBudget({root,directory,pairedExitPath}) {
 const source=captureSourceIdentity(root);
 const policyBytes=bytes(join(root,budgetSelection.path));
 requireValue(digest(policyBytes)===budgetSelection.sha256,'Unapproved budget content');
 const budget=JSON.parse(policyBytes);
 const binding=budget.measurementBindings;
 requireValue(process.version===binding.runtime&&process.versions.zlib===binding.zlib&&process.versions.brotli===binding.brotli,'Compressor/runtime mismatch');
 for(const file of binding.artifacts) requireValue(digest(bytes(join(root,file.path)))===file.sha256,'Measurement substrate changed: '+file.path);
 const packageJson=readJson(join(root,'package.json'));
 const boundaryErrors=validateApplicationBoundary(source,packageJson,budget);
 requireValue(!boundaryErrors.length,boundaryErrors.join('; '));
 const debt=readHistoricalControl(controlSelection,path=>bytes(join(root,path)));
 const read=name=>readJson(join(directory,name));
 const result=read('result.json'),identity=read('identity.json');
 requireValue(result.cleanup===true&&result.sourceUnchanged===true&&!result.identityError&&!result.cleanupError&&result.baseSha===baselineSha&&resolve(result.directory)===resolve(directory),'Incomplete paired result/cleanup');
 requireValue(isDeepStrictEqual(identity.schedule,schedule)&&isDeepStrictEqual(identity.policy,historicalPolicy)&&isDeepStrictEqual(identity.control,controlSelection)&&identity.baseSha===baselineSha&&identity.node===process.version,'Paired identity/policy/control mismatch');
 requireValue(result.sourceSha256===source.sha256&&isDeepStrictEqual(source,identity.source)&&isDeepStrictEqual(source,read('source-before.json'))&&isDeepStrictEqual(source,read('source-after.json')),'Stale/different source evidence');
 requireValue(result.candidateHeadAfter===identity.candidateHead,'Candidate HEAD changed');
 const assets=collectBudgetAssets(join(root,'dist/app/browser'),budget);
 requireValue(isDeepStrictEqual(assets.build,read('candidate-output-identity.json'))&&isDeepStrictEqual(assets.build,read('candidate-output-after.json')),'Build changed since measurement');
 requireValue(isDeepStrictEqual(read('baseline-output-identity.json'),read('baseline-output-after.json')),'Historical build changed during measurement');
 const baseBuild=read('baseline-build-identity.json'),candidateBuild=read('candidate-build-identity.json');
 requireValue(baseBuild.sha===baselineSha&&!validateControlRuntime(debt,baseBuild).length,'Wrong historical source/runtime');
 requireValue(candidateBuild.sourceSha256===source.sha256&&candidateBuild.outputSha256===assets.build.sha256&&candidateBuild.node===process.version&&candidateBuild.packageManager===packageJson.packageManager&&candidateBuild.lockSha256===digest(bytes(join(root,'pnpm-lock.yaml'))),'Candidate build identity mismatch');
 const receipt=(name,status)=>{
  const r=read(name+'.exit.json'),raw=read(name+'.supervision.json');
  const errors=validateBudgetReceipt(r,raw,status);
  requireValue(!errors.length,name+': '+errors.join('; '));
  requireValue(bytes(join(directory,name+'.stderr.log')).toString()===r.stderr,name+': stderr differs from raw receipt');
  return r;
 };
 for(const name of ['baseline-worktree-add','baseline-node','baseline-corepack','baseline-pnpm','baseline-install','baseline-toolchain','baseline-build','candidate-pnpm','candidate-install','candidate-toolchain','candidate-build','browser-contract']) receipt(name,0);
 const observations={baseline:[],candidate:[]};
 requireValue(Array.isArray(result.attempts)&&result.attempts.length===schedule.length,'Missing/extra attempts');
 let browser=null,previousEnd=-Infinity;
 for(const [index,side] of schedule.entries()) {
  const name=`${index+1}-${side}`,status=side==='baseline'?1:0;
  const expected={name,side,status,validationErrors:[],productVerdict:side==='baseline'?'KNOWN_BASELINE_FAILURE_NOT_PRODUCT_PASS':'PASS'};
  requireValue(isDeepStrictEqual(result.attempts[index],expected),'Attempt identity/order/verdict mismatch');
  const r=receipt(name,status),evidence=read(name+'/browser.json');
  const start=Date.parse(r.startedAt),end=Date.parse(r.finishedAt);
  requireValue(Number.isFinite(start)&&Number.isFinite(end)&&start>=previousEnd&&end>=start,'Nonsequential/invalid measurement times');previousEnd=end;
  const errors=validateAttempt({side,receipt:r,evidence,debt,browser});
  requireValue(!errors.length,name+': '+errors.join('; '));
  for(const scan of evidence.runs[0].a11y) {
   const file=`axe-${scan.name}-repeat-1.json`,raw=bytes(join(directory,name,file));
   requireValue(scan.diagnostics?.file===file&&scan.diagnostics.sha256===digest(raw),'Missing/changed raw axe diagnostic');
   const axe=JSON.parse(raw);
   requireValue(axe.testEngine?.version===debt.measurement.axe&&Array.isArray(axe.incomplete)&&Array.isArray(axe.passes)&&isDeepStrictEqual(axe.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),scan.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))),'Raw axe content mismatch');
  }
  browser??=evidence.browser;observations[side].push(evidence);
 }
 const base=combineAttempts(observations.baseline),candidate=combineAttempts(observations.candidate),baseline=read('baseline.json');
 requireValue(isDeepStrictEqual(base,read('baseline-browser.json'))&&isDeepStrictEqual(candidate,read('candidate.json')),'Supplied aggregate differs from complete raw observations');
 const expectedBase={baseSha:baselineSha,schema:base.schema,browser:base.browser,timingSubstrate:base.timingSubstrate,initial:baseline.initial,policy:historicalPolicy,journeys:Object.fromEntries(Object.entries(base.aggregate.journeys).map(([name,j])=>[name,{medianInMs:j.medianInMs,requestCount:Math.max(...j.requestCounts)}])),routeResources:Object.fromEntries(Object.entries(base.aggregate.journeys).map(([name,j])=>[name,{rawBytes:Math.max(...j.resourceSummaries.map(r=>r.decodedBodySizeInBytes)),requestCount:Math.max(...j.resourceSummaries.map(r=>r.count))}]))};
 requireValue(isDeepStrictEqual(baseline,expectedBase),'Fresh baseline differs from raw measurements/policy');
 const legacy=read('performance.json'),failures=historicalRegressions(baseline,candidate,assets.initial);
 const oldStatus=failures.length?1:0;
 const oldVerdict=failures.length?'FAIL':'PASS: size/request non-regression; timing retained as repeated local-lab evidence';
 const oldTiming=failures.some(f=>f.startsWith('Timing regression'))?'INCONCLUSIVE_OR_FAIL':'COMPARABLE_WITHIN_PRESET_NOISE_RULE';
 const sizeComparison={baseline:baseline.initial,candidate:assets.initial,deltas:Object.fromEntries(Object.keys(baseline.initial).map(key=>[key,assets.initial[key]-baseline.initial[key]]))};
 requireValue(isDeepStrictEqual(legacy,{schema:'thinaticsystem-modernization/performance-check/v1',baseSha:baselineSha,candidateHead:identity.candidateHead,timingSubstrate:candidate.timingSubstrate,sizeComparison,journeys:candidate.aggregate.journeys,policy:historicalPolicy,timingVerdict:oldTiming,regressions:failures,verdict:oldVerdict}),'Unknown/changed historical failure categories');
 const performanceReceipt=receipt('performance',oldStatus);
 requireValue(performanceReceipt.stderr===''&&isDeepStrictEqual(JSON.parse(bytes(join(directory,'performance.stdout.log'))),legacy),'Historical comparator output mismatch');
 requireValue(result.verdict===(oldStatus?'FAIL':'PASS_PAIRED_PERFORMANCE_ONLY')&&(oldStatus?result.error?.split('\n')[0]==='Error: performance failed: see raw receipt':!result.error),'Unclassified paired failure');
 requireValue(pairedExitPath.endsWith('.exit.json'),'Explicit paired owner exit receipt required');
 const parentReceipt=readJson(pairedExitPath);
 const parentErrors=validateBudgetReceipt(parentReceipt,readJson(pairedExitPath.replace(/\.exit\.json$/,'.supervision.json')),oldStatus);
 requireValue(!parentErrors.length,'Parent process: '+parentErrors.join('; '));
 requireValue(parentReceipt.executable==='corepack'&&isDeepStrictEqual(parentReceipt.args,['pnpm','run','perf:paired'])&&resolve(parentReceipt.cwd)===resolve(root),'Parent receipt is not the declared paired command');
 const declaredRuns=bytes(pairedExitPath.replace(/\.exit\.json$/,'.stdout.log')).toString().split('\n').filter(line=>line.startsWith('Paired evidence: '));
 requireValue(isDeepStrictEqual(declaredRuns,['Paired evidence: '+resolve(directory)]),'Parent stdout/run directory mismatch');
 const sideMeasurement=(aggregate,name)=>({timesInMs:aggregate.journeys[name].runs,requestCounts:aggregate.journeys[name].requestCounts,resourceSummaries:aggregate.journeys[name].resourceSummaries});
 const measurement={initial:assets.initial,baselineInitial:baseline.initial,detailChunkRawBytes:assets.detailChunkRawBytes,allEmittedJsCssRawBytes:assets.allEmittedJsCssRawBytes,journeys:journeyNames.map(name=>({name,baseline:sideMeasurement(base.aggregate,name),candidate:sideMeasurement(candidate.aggregate,name)}))};
 const verdict=evaluateFunctionalBudget(budget,measurement);
 requireValue(isDeepStrictEqual(source,captureSourceIdentity(root)),'Source changed while evaluating');
 return {...verdict,budget:budgetSelection,sourceSha256:source.sha256,buildSha256:assets.build.sha256,pairedDirectory:resolve(directory),measurement,assets:{initialFiles:assets.initialFiles,detailFile:assets.detailFile,emitted:assets.emitted},historicalRaw:{verdict:legacy.verdict,regressions:legacy.regressions},boundaryReview:'UNCHANGED_REVIEWED_APPLICATION_INPUTS',releaseAuthorization:'NOT_GRANTED'};
}
