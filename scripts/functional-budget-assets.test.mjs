import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {collectBudgetAssets, applicationFiles, validateApplicationBoundary} from './functional-budget-assets.mjs';

function fixture(run) {
 const root=mkdtempSync(join(tmpdir(),'functional-assets-'));
 try {
  writeFileSync(join(root,'index.html'),'<script src="main.js" type="module"></script><link rel="stylesheet" href="style.css">');
  writeFileSync(join(root,'main.js'),'console.log("test-owned fixture");');
  writeFileSync(join(root,'style.css'),'body{color:black}');
  writeFileSync(join(root,'detail.js'),'selectors:[["app-detail"]]');
  run(root);
 } finally {rmSync(root,{recursive:true,force:true});}
}
const policy={detailLogicalRoot:{selector:'app-detail'}};
test('inventory counts every emitted JS/CSS file and initial compression separately',()=>fixture(root=>{
 const r=collectBudgetAssets(root,policy);
 assert.equal(r.initial.rawBytes,51);assert.equal(r.detailChunkRawBytes,26);
 assert.equal(r.allEmittedJsCssRawBytes,77);assert.equal(r.emitted.length,3);
 assert.ok(r.initial.gzipBytes>0);assert.ok(r.initial.brotliBytes>0);
}));
for(const [name,edit] of [
 ['missing root',root=>rmSync(join(root,'detail.js'))],
 ['duplicate root',root=>writeFileSync(join(root,'another.js'),'selectors:[["app-detail"]]')],
 ['inline application code',root=>writeFileSync(join(root,'index.html'),'<script>console.log(1)</script>')],
 ['external application code',root=>writeFileSync(join(root,'index.html'),'<script src="https://cdn.invalid/main.js"></script>')],
 ['query classification escape',root=>writeFileSync(join(root,'index.html'),'<script src="main.js?v=1"></script>')],
 ['single-quote collector mismatch',root=>writeFileSync(join(root,'index.html'),"<script src='main.js'></script>")],
 ['unrecognized executable class',root=>writeFileSync(join(root,'extra.wasm'),'fixture-not-real-wasm')],
 ['symlink asset',root=>symlinkSync('main.js',join(root,'alias.js'))],
 ['missing initial file',root=>rmSync(join(root,'main.js'))],
]) test(name+' fails closed',()=>fixture(root=>{edit(root);assert.throws(()=>collectBudgetAssets(root,policy));}));
const source={files:[{path:'src/app/app.routes.ts',kind:'file',sha256:'same',sizeInBytes:10},{path:'src/app/demo.spec.ts',kind:'file',sha256:'test'},{path:'scripts/gate.mjs',kind:'file',sha256:'tool'}]};
const boundary={applicationBoundary:{kind:'exact-reviewed-application-inputs/v1',files:applicationFiles(source),packageMetadata:{name:'fixture'}}};
test('unchanged reviewed application inputs permit tooling-only changes',()=>{
 assert.deepEqual(validateApplicationBoundary(source,{name:'fixture',scripts:{new:'node script'}},boundary),[]);
});
for(const [name,edit] of [
 ['move route code into initial',s=>s.files[0].sha256='eager-import'],
 ['late dynamic import after readiness',s=>s.files.push({path:'src/app/late.ts',kind:'file',sha256:'late-import'})],
 ['new service worker',s=>s.files.push({path:'public/sw.js',kind:'file',sha256:'worker'})],
 ['data-loaded code',s=>s.files.push({path:'src/assets/code.json',kind:'file',sha256:'data-code'})],
]) test(name+' requires a fresh boundary review even below byte ceilings',()=>{
 const changed=structuredClone(source);edit(changed);
 assert.ok(validateApplicationBoundary(changed,{name:'fixture'},boundary).length);
});
test('dependency metadata changes require review',()=>{
 assert.ok(validateApplicationBoundary(source,{name:'fixture',dependencies:{new:'1'}},boundary).length);
});
