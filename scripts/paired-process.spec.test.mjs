import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {controlSelection} from './paired-baseline-control.mjs';
import {symlinkSync,realpathSync} from 'node:fs';
const controlArgs=['--baseline-control',controlSelection.path,'--baseline-control-sha256',controlSelection.sha256];
import {compileSupervisor, runOwnedCommand} from './paired-process.mjs';


test('Given a supervisor owns child processes and cleanup When an owned process exits or cleanup is checked Then supervisor reaps worker-thread detached descendants on exit0, exit1, crash, timeout and cancel', {timeout:20_000}, async () => {
  const {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,openSync,closeSync} = await import('node:fs');
  const {resolve,join} = await import('node:path');
  const {setTimeout:delay} = await import('node:timers/promises');
  mkdirSync(resolve('.artifacts/paired-ci'),{recursive:true});
  const dir=mkdtempSync(resolve('.artifacts/paired-ci/owner-fixture-'));
  const supervisor=compileSupervisor(dir);
  const unrelated=spawn(process.execPath,['-e','setTimeout(()=>{},15000)'],{stdio:'ignore'});
  const unrelatedClosed=once(unrelated,'close');
  try {
    for(const mode of ['exit0','exit1','crash','timeout','cancel','missing']) {
      const marker=join(dir,mode+'.pid');
      const orphanCode="const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setTimeout(()=>{},15000)'],{detached:true,stdio:'ignore'});require('node:worker_threads').parentPort.postMessage(c.pid);setTimeout(()=>{},15000);";
      const code="const fs=require('node:fs'); const {Worker}=require('node:worker_threads');const w=new Worker("+JSON.stringify(orphanCode)+",{eval:true});w.on('message',pid=>{fs.writeFileSync("+JSON.stringify(marker)+",String(pid));"+(mode==='exit0'?'process.exit(0);':mode==='exit1'?'process.exit(1);':mode==='crash'?"process.kill(process.pid,'SIGKILL');":"")+"});setTimeout(()=>{},15000);";
      const out=openSync(join(dir,mode+'.stdout'),'wx'),err=openSync(join(dir,mode+'.stderr'),'wx');
      const controller=new AbortController();let orphan=null;
      try {
        const pending=runOwnedCommand(mode==='missing'?'/nonexistent-paired-executable':process.execPath,mode==='missing'?[]:['-e',code],{supervisor,receiptPath:join(dir,mode+'.json'),cwd:process.cwd(),env:process.env,stdout:out,stderr:err,timeoutInMs:mode==='timeout'?1000:5000,signal:controller.signal});
        if(mode==='cancel'){
          for(let n=0;n<100&&!existsSync(marker);n++)await delay(20);
          controller.abort();
        }
        const receipt=await pending;
        if(mode!=='missing') {assert.ok(existsSync(marker),mode+' did not start detached child');orphan=Number(readFileSync(marker,'utf8'));}
        assert.equal(receipt.cleanup,true,JSON.stringify(receipt));assert.deepEqual(receipt.cleanupErrors,[]);
        if(orphan)assert.equal(existsSync('/proc/'+orphan),false,mode+' left live/zombie child');
        if(mode==='exit0'||mode==='exit1') {assert.equal(receipt.status,mode==='exit0'?0:1);assert.equal(receipt.signal,null);}
        if(['crash','timeout','cancel'].includes(mode))assert.equal(receipt.signal,'SIGKILL',JSON.stringify(receipt));
        assert.equal(receipt.timedOut,mode==='timeout');assert.equal(receipt.interrupted,mode==='cancel');
        assert.equal(receipt.error!==null,mode==='missing');
        process.kill(unrelated.pid,0);process.kill(process.pid,0);
      } finally {
        controller.abort();if(orphan){try{process.kill(orphan,'SIGKILL')}catch{}}
        closeSync(out);closeSync(err);
      }
    }
  } finally {unrelated.kill('SIGKILL');await unrelatedClosed;rmSync(dir,{recursive:true,force:true});}
});

test('Given a supervisor owns child processes and cleanup When an owned process exits or cleanup is checked Then SIGTERM during registered worktree creation removes only that owned worktree', {timeout: 20_000}, async () => {
  const {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} = await import('node:fs');
  const {resolve, join, delimiter} = await import('node:path');
  const {execFileSync} = await import('node:child_process');
  const {setTimeout: delay} = await import('node:timers/promises');
  mkdirSync('.artifacts/paired-ci', {recursive: true});
  const temporary = mkdtempSync(resolve('.artifacts/paired-ci/cancel-probe-'));
  const marker = join(temporary, 'registered');
  const realGit = execFileSync('which', ['git'], {encoding: 'utf8'}).trim();
  const before = execFileSync(realGit, ['worktree', 'list', '--porcelain'], {encoding: 'utf8'});
  const shim = `#!${process.execPath}\nconst {spawnSync}=require('node:child_process');const fs=require('node:fs');const args=process.argv.slice(2);const add=args[0]==='worktree'&&args[1]==='add';if(add)args.splice(2,0,'--no-checkout');const r=spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});if(add&&r.status===0){fs.writeFileSync(${JSON.stringify(marker)},'registered');setTimeout(()=>process.exit(0),30000);}else process.exit(r.status??1);\n`;
  writeFileSync(join(temporary, 'git'), shim, {mode: 0o755});
  const child = spawn(process.execPath, ['scripts/paired-performance.mjs',...controlArgs], {env: {...process.env, PATH: temporary + delimiter + process.env.PATH}, stdio: ['ignore', 'pipe', 'pipe']});
  let output = ''; let stderr = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { stderr += data; });
  const closed = once(child, 'close');
  try {
    for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt += 1) await delay(50);
    assert.ok(existsSync(marker), `Creation probe never reached registration: ${output} ${stderr}`);
    child.kill('SIGTERM');
    const [status, signal] = await closed;
    assert.equal(status, 1); assert.equal(signal, null);
    const runPath = output.match(/Paired evidence: (.+)/)?.[1];
    assert.ok(runPath);
    const result = JSON.parse(readFileSync(join(runPath, 'result.json')));
    assert.equal(result.sourceUnchanged,true);assert.ok(JSON.parse(readFileSync(join(runPath,'source-after.json'))).files.length>0);
    assert.equal(result.cleanup, true); assert.equal(result.verdict, 'FAIL'); assert.deepEqual(result.attempts, []);
    assert.equal(execFileSync(realGit, ['worktree', 'list', '--porcelain'], {encoding: 'utf8'}), before);
    writeFileSync(join(runPath, 'fixture-only.json'), JSON.stringify({purpose: 'Cancellation after real git registration, before checkout command completion',status,signal}));
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    rmSync(temporary, {recursive: true, force: true});
  }
});


test('Given a supervisor owns child processes and cleanup When an owned process exits or cleanup is checked Then real runner reaps detached orphan after failed install before cleanup:true', {timeout:20_000}, async () => {
  const {mkdtempSync,writeFileSync,existsSync,rmSync} = await import('node:fs');
  const {resolve,join,delimiter} = await import('node:path');
  const {execFileSync} = await import('node:child_process');
  const {setTimeout:delay} = await import('node:timers/promises');
  const dir = mkdtempSync(resolve('.artifacts/paired-ci/orphan-fixture-'));
  const marker = join(dir,'pid');
  const before = execFileSync('git',['worktree','list','--porcelain'],{encoding:'utf8'});
  assert.ok(process.env.BASELINE_NODE_EXECUTABLE,'Nix/setup-node baseline runtime required for process fixture');
  symlinkSync(realpathSync(process.env.BASELINE_NODE_EXECUTABLE),join(dir,'node'));
  writeFileSync(join(dir,'corepack'),'#!'+process.execPath+'\n'+
    "if(process.argv[2]==='--version'){console.log('0.34.6');process.exit(0)}if(process.argv[2]==='pnpm'&&process.argv[3]==='--version'){console.log('9.10.0');process.exit(0)}if(process.argv[2]!=='pnpm'||process.argv[3]!=='install')throw Error('Unexpected fixture stage');"+
    "const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setTimeout(()=>{},15000)'],{detached:true,stdio:'ignore'});fs.writeFileSync("+JSON.stringify(marker)+",String(child.pid));fs.writeFileSync("+JSON.stringify(marker+'.tmpdir')+", process.env.TMPDIR);child.unref();process.exit(1);\n",{mode:0o755});
  const child = spawn(process.execPath,['scripts/paired-performance.mjs',...controlArgs],{env:{...process.env,BASELINE_NODE_EXECUTABLE:join(dir,'node'),PATH:dir+delimiter+process.env.PATH},stdio:['ignore','pipe','pipe']});
  let output=''; let stderr=''; let orphan=null;
  child.stdout.on('data',d=>{output+=d}); child.stderr.on('data',d=>{stderr+=d});
  const timer=setTimeout(()=>child.kill('SIGTERM'),10_000);
  try {
    const [status,signal] = await once(child,'close');
    assert.equal(status,1,stderr); assert.equal(signal,null);
    assert.ok(existsSync(marker),'Fixture did not reach failed install: '+output+stderr);
    orphan=Number(readFileSync(marker,'utf8'));
    const stageTemporary = readFileSync(marker+'.tmpdir', 'utf8');
    assert.ok(Buffer.byteLength(stageTemporary+'/org.chromium.Chromium.123456/SingletonSocket') < 108, 'Chromium socket must fit AF_UNIX');
    assert.equal(existsSync(stageTemporary), false, 'Stage temporary directory must be removed after cleanup');
    const run=output.match(/Paired evidence: (.+)/)?.[1]; assert.ok(run,output);
    const result=JSON.parse(readFileSync(join(run,'result.json')));
    assert.equal(result.sourceUnchanged,true);assert.ok(JSON.parse(readFileSync(join(run,'source-after.json'))).files.length>0);
    writeFileSync(join(run,'fixture-only.json'),JSON.stringify({purpose:'orphan failed install regression',orphan}));
    assert.equal(result.verdict,'FAIL');assert.equal(result.cleanup,true);
    assert.equal(execFileSync('git',['worktree','list','--porcelain'],{encoding:'utf8'}),before);
    assert.equal(existsSync('/proc/'+orphan),false,'Orphan must be terminated AND reaped before cleanup:true');
  } finally {
    clearTimeout(timer);
    if(orphan){try{process.kill(orphan,'SIGKILL')}catch{}}
    if(child.exitCode===null)child.kill('SIGTERM');
    await delay(30);rmSync(dir,{recursive:true,force:true});
  }
});


test('Given a supervisor owns child processes and cleanup When an owned process exits or cleanup is checked Then owner receipt absence, malformed data and unverified cleanup fail closed', async () => {
  const {mkdtempSync,writeFileSync,rmSync,openSync,closeSync} = await import('node:fs');
  const {resolve,join} = await import('node:path');
  const dir=mkdtempSync(resolve('.artifacts/paired-ci/receipt-fixture-'));
  try {
    for(const [name,body,ownerExit] of [['missing',null,0],['malformed','{',0],['unclean',JSON.stringify({schema:1,status:0,signal:null,timedOut:false,interrupted:0,spawnErrno:0,cleanup:false,cleanupErrno:1}),0],['owner-failed',JSON.stringify({schema:1,status:0,signal:null,timedOut:false,interrupted:0,spawnErrno:0,cleanup:true,cleanupErrno:0}),125]]){
      const fake=join(dir,name+'.owner');
      writeFileSync(fake,'#!'+process.execPath+'\n'+(body===null?'':"require('node:fs').writeFileSync(process.argv[2],"+JSON.stringify(body)+");")+'process.exit('+ownerExit+');',{mode:0o755});
      const out=openSync(join(dir,name+'.out'),'wx'),err=openSync(join(dir,name+'.err'),'wx');
      try {
        const r=await runOwnedCommand(process.execPath,['-e','process.exit(0)'],{supervisor:fake,receiptPath:join(dir,name+'.json'),cwd:process.cwd(),env:process.env,stdout:out,stderr:err,timeoutInMs:1000});
        assert.equal(r.cleanup,false);assert.ok(r.cleanupErrors.length);assert.notEqual(r.error,null);
      } finally {closeSync(out);closeSync(err);}
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
