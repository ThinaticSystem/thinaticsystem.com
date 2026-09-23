import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {controlSelection,readHistoricalControl,validateControlRuntime,validateMeasurementControl} from './paired-baseline-control.mjs';
import {captureSourceIdentity,captureBuildIdentity} from './paired-identity.mjs';
const control=()=>readHistoricalControl(controlSelection);
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then v2 retains parent and precisely two additional measured nodes',()=>{
 const current=control();const old=JSON.parse(readFileSync('test/paired-baseline-debt.json'));const expected=structuredClone(old.axe);
 for(const name of ['desktop.blog-list','mobile.menu-blog']) expected.find(s=>s.name===name).violations.unshift({id:'color-contrast',impact:'serious',targets:[['a[href$="fixture"]']]});
 assert.deepEqual(current.axe,expected);assert.equal(current.scope,'historical-performance-control-only');
});
for(const [name,selection] of [['missing',{}],['wrong hash',{...controlSelection,sha256:'0'.repeat(64)}],['old',{path:'test/paired-baseline-debt.json',sha256:'23aa45dd621b4ae385dd127515e9115f3952ca79b0c1ae415978304fbf616be3'}]]) test('reject selection '+name,()=>assert.throws(()=>readHistoricalControl(selection)));
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then runtime requires actual Node22, exact executable, Corepack, pnpm and lock',()=>{
 const c=control();const runtime={node:'v22.23.2',execPath:'/fixture/node',expectedExecPath:'/fixture/node',corepack:'0.34.6',pnpm:'9.10.0',lockSha256:c.baseline.lockSha256};assert.deepEqual(validateControlRuntime(c,runtime),[]);
 for(const [key,value] of [['node','v24.19.0'],['execPath','/wrong/node'],['corepack','0.0.0'],['pnpm','12.3.4'],['lockSha256','other']]) assert.ok(validateControlRuntime(c,{...runtime,[key]:value}).length,key);
});
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then measurement rejects missing/wrong browser, axe, driver and Playwright',()=>{
 const c=control();const evidence={browser:{version:c.measurement.chromium},toolchain:{node:c.measurement.node,playwright:c.measurement.playwright,axe:c.measurement.axe}};assert.deepEqual(validateMeasurementControl(c,evidence),[]);
 for(const key of ['node','axe','playwright']){const e=structuredClone(evidence);e.toolchain[key]='wrong';assert.ok(validateMeasurementControl(c,e).length,key);delete e.toolchain[key];assert.ok(validateMeasurementControl(c,e).length,key);}
 assert.ok(validateMeasurementControl(c,{...evidence,browser:{version:'141.0.0.0'}}).length);
});
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then source identity covers tracked/untracked bytes, modes, additions/deletions; excludes generated',()=>{
 mkdirSync('.artifacts/paired-ci',{recursive:true});const dir=mkdtempSync(resolve('.artifacts/paired-ci/identity-fixture-'));const git=args=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 try{git(['init']);writeFileSync(join(dir,'.gitignore'),'.artifacts/\nnode_modules/\ndist/\n');writeFileSync(join(dir,'tracked'),'original');git(['add','.']);writeFileSync(join(dir,'.baseline-node-version'),'22.23.2');const initial=captureSourceIdentity(dir);assert.ok(initial.files.some(f=>f.path==='.baseline-node-version'));assert.ok(initial.files.some(f=>f.path==='tracked'));
 for(const sub of ['.artifacts','node_modules','dist']){mkdirSync(join(dir,sub));writeFileSync(join(dir,sub,'generated'),'ignore');}assert.deepEqual(captureSourceIdentity(dir),initial);
 writeFileSync(join(dir,'tracked'),'changed');assert.notEqual(captureSourceIdentity(dir).sha256,initial.sha256);writeFileSync(join(dir,'tracked'),'original');chmodSync(join(dir,'tracked'),0o755);assert.notEqual(captureSourceIdentity(dir).sha256,initial.sha256);chmodSync(join(dir,'tracked'),0o644);
 writeFileSync(join(dir,'new-source'),'new');assert.notEqual(captureSourceIdentity(dir).sha256,initial.sha256);rmSync(join(dir,'new-source'));rmSync(join(dir,'.baseline-node-version'));assert.notEqual(captureSourceIdentity(dir).sha256,initial.sha256);
 writeFileSync(join(dir,'.env'),'SECRET FIXTURE ONLY');assert.throws(()=>captureSourceIdentity(dir),/secret/i);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then build identity detects output bytes and missing index',()=>{
 const dir=mkdtempSync(resolve('.artifacts/paired-ci/build-identity-fixture-'));try{writeFileSync(join(dir,'index.html'),'fixture');const before=captureBuildIdentity(dir);writeFileSync(join(dir,'new.js'),'fixture');assert.notEqual(captureBuildIdentity(dir).sha256,before.sha256);rmSync(join(dir,'index.html'));assert.throws(()=>captureBuildIdentity(dir));}finally{rmSync(dir,{recursive:true,force:true});}
});

for(const [name,mutate] of Object.entries({
 'missing node':c=>c.axe[2].violations.shift(),
 'extra node':c=>c.axe[2].violations[0].targets.push(['other']),
 'impact':c=>{c.axe[2].violations[0].impact='moderate'},
 'target':c=>{c.axe[2].violations[0].targets=[['other']]},
 'scope':c=>{c.scope='product-debt'},
 'runtime':c=>{c.baseline.node='v24.19.0'},
 'browser':c=>{c.measurement.chromium='141.0.0.0'},
 'axe':c=>{c.measurement.axe='4.10.2'},
}))test('Given a continuation receipt is content-addressed When the ' + name + ' field is mutated Then validation rejects it',()=>{
 const changed=control();mutate(changed);
 const read=p=>p===controlSelection.path?Buffer.from(JSON.stringify(changed)):readFileSync(p);
 assert.throws(()=>readHistoricalControl(controlSelection,read),/content changed/);
});
test('Given a continuation receipt describes a paired measurement When the continuation is validated Then parent and substrate bytes cannot be silently changed',()=>{
 const c=control();for(const target of [c.parent.path,...Object.keys(c.inputHashes)])assert.throws(()=>readHistoricalControl(controlSelection,p=>p===target?Buffer.from('changed fixture'):readFileSync(p)));
});

test('Given a continuation receipt describes a paired measurement When the continuation is validated Then CI selects baseline before candidate, runs required local gates, and never ignores failure',()=>{
 const workflow=readFileSync('.github/workflows/ci.yml','utf8');
 const baseline=workflow.indexOf('node-version-file: .baseline-node-version');const saved=workflow.indexOf('BASELINE_NODE_EXECUTABLE=');const candidate=workflow.indexOf('node-version-file: .node-version');
 assert.ok(baseline>=0&&saved>baseline&&candidate>saved);assert.ok(!workflow.includes('continue-on-error'));
 for(const script of ['test:paired-contract','perf:current','test:performance-contract','test:performance-recorder','test:e2e','test:known-defects:contract','test:known-defects','docs:check'])assert.ok(workflow.includes('corepack pnpm run '+script),script);
 assert.ok(workflow.includes('if: always()'));assert.ok(workflow.includes('fetch-depth: 0'));
 for(const name of ['Current performance contract fixtures','Actual-browser recorder canaries','Candidate browser functionality and accessibility','Calibrated same-runner current performance','TypeDoc','Fixture-only local HTTP contract smoke']){const step=workflow.split('      - name: '+name+'\n')[1]?.split('      - name: ')[0];assert.ok(step?.includes("if: ${{ !cancelled() && steps.build.outcome == 'success' }}"),name+' must not be skipped after another check fails');}
 const command=JSON.parse(readFileSync('package.json')).scripts['perf:paired'];assert.ok(command.includes('--baseline-control '+controlSelection.path));assert.ok(command.includes('--baseline-control-sha256 '+controlSelection.sha256));
 const flake=readFileSync('flake.nix','utf8');assert.ok(flake.includes('baselineNode = pkgs.nodejs_22'));assert.ok(flake.includes('assert baselineNode.version == baselineNodeVersion'));assert.ok(flake.includes('BASELINE_NODE_EXECUTABLE = "${baselineNode}/bin/node"'));
});
