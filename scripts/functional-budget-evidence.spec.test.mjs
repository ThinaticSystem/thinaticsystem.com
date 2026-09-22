import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {validateBudgetReceipt,historicalRegressions} from './functional-budget-evidence.mjs';

const receipt={status:1,signal:null,error:null,timedOut:false,interrupted:false,cleanup:true,cleanupErrors:[],supervisor:{status:0,signal:null}};
const raw={schema:1,status:1,signal:null,timedOut:false,interrupted:0,spawnErrno:0,cleanup:true,cleanupErrno:0};
test('Given a budget run produces an evidence receipt when the run is recorded Then clean expected comparator FAIL remains usable data, not whole-job PASS',()=>assert.deepEqual(validateBudgetReceipt(receipt,raw,1),[]));
for(const [key,value] of [['status',0],['signal','SIGTERM'],['error','TypeError'],['timedOut',true],['interrupted',true],['cleanup',false],['cleanupErrors',['lost child']],['supervisor',{status:1,signal:null}]]) test('reject receipt '+key,()=>assert.ok(validateBudgetReceipt({...receipt,[key]:value},raw,1).length));
for(const [key,value] of [['schema',2],['status',0],['signal',15],['timedOut',true],['interrupted',1],['spawnErrno',2],['cleanup',false],['cleanupErrno',1]]) test('reject raw supervision '+key,()=>assert.ok(validateBudgetReceipt(receipt,{...raw,[key]:value},1).length));
test('Given a budget run produces an evidence receipt when the run is recorded Then missing raw/owner receipt rejected',()=>{assert.ok(validateBudgetReceipt(null,raw,1).length);assert.ok(validateBudgetReceipt(receipt,null,1).length);});
test('Given a budget run produces an evidence receipt when the run is recorded Then historical size plus timing plus requests remain distinct exact failures',()=>{
 const baseline={initial:{rawBytes:1,gzipBytes:1,brotliBytes:1},policy:{timing:{maxRelativeRegression:0.2}},journeys:{example:{requestCount:1,medianInMs:100}},routeResources:{example:{rawBytes:1,requestCount:1}}};
 const candidate={aggregate:{journeys:{example:{requestCounts:[2,2,2,2],medianInMs:121,resourceSummaries:[{count:2,decodedBodySizeInBytes:2,transferSizeInBytes:602}]}}}};
 const failures=historicalRegressions(baseline,candidate,{rawBytes:2,gzipBytes:2,brotliBytes:2});
 assert.equal(failures.length,6);assert.match(failures[0],/^Request count regression/);assert.match(failures[1],/^Timing regression/);assert.match(failures[2],/^Lazy-route resource regression/);
});
test('Given a budget run produces an evidence receipt when the run is recorded Then real CLI writes a new explicit failure on every invalid invocation; no stale PASS receipt',()=>{
 const root=mkdtempSync(join(tmpdir(),'functional-cli-'));const cli=resolve('scripts/functional-budget.mjs');
 try {
  for(const args of [[],['--unknown'],['--paired-run','missing','--paired-exit','missing.exit.json']]) {
   const child=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',timeout:15_000,env:{...process.env,TMPDIR:root}});
   assert.equal(child.status,1);assert.equal(child.signal,null);
   const printed=JSON.parse(child.stdout);assert.equal(printed.overall,'FAIL');assert.equal(printed.valid,false);assert.equal(printed.verdict,'INVALID_EVIDENCE');
   const onDisk=JSON.parse(readFileSync(printed.output,'utf8'));assert.equal(onDisk.verdict,'INVALID_EVIDENCE');
  }
  assert.equal(readdirSync(join(root,'.artifacts/functional-budget')).length,3);
 } finally {rmSync(root,{recursive:true,force:true});}
});
