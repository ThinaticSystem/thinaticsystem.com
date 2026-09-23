import {readFileSync, openSync, closeSync} from 'node:fs';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {constants} from 'node:os';

/** Compile the tiny Linux owner into this invocation's ignored evidence directory.
 * Requires an existing C compiler; never installs dependencies or changes privileges.
 */
export function compileSupervisor(directory) {
  if (process.platform !== 'linux') throw new Error('Paired commands require Linux subreaper support');
  const executable = join(directory, 'paired-supervisor');
  const out = openSync(join(directory, 'supervisor-build.stdout.log'), 'wx');
  const err = openSync(join(directory, 'supervisor-build.stderr.log'), 'wx');
  try {
    execFileSync('cc', ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', fileURLToPath(new URL('./paired-supervisor.c', import.meta.url)), '-o', executable], {timeout:30_000, stdio:['ignore', out, err]});
  } finally { closeSync(out); closeSync(err); }
  return executable;
}

/** Own exactly one command and adopted descendants through a private subreaper.
 * Raw child outcome is separate from supervisor completion. Missing/invalid receipts
 * fail closed; cancellation requests cleanup instead of killing the owner first.
 */
export async function runOwnedCommand(executable, args, {supervisor, receiptPath, cwd, env, stdout, stderr, timeoutInMs, signal}) {
  let spawnError = null;
  let watchdogExpired = false;
  let timer;
  const child = spawn(supervisor, [receiptPath, String(timeoutInMs), executable, ...args], {cwd, env, detached:true, stdio:['ignore', stdout, stderr]});
  const forceUnknown = () => { watchdogExpired = true; child.kill('SIGKILL'); };
  const cancel = () => {
    child.kill('SIGTERM');
    clearTimeout(timer); timer = setTimeout(forceUnknown, 7_000);
  };
  try {
    timer = setTimeout(forceUnknown, timeoutInMs + 7_000);
    signal?.addEventListener('abort', cancel, {once:true});
    if (signal?.aborted) cancel();
    const owner = await new Promise(resolve => {
      child.on('error', error => { spawnError = error.message; });
      child.on('close', (status, signal) => resolve({status, signal}));
    });
    const failures = [];
    let raw = null;
    try { raw = JSON.parse(readFileSync(receiptPath, 'utf8')); }
    catch (error) { failures.push('Missing/invalid supervision receipt: ' + error.message); }
    const valid = raw?.schema === 1 && typeof raw.cleanup === 'boolean' && Number.isInteger(raw.cleanupErrno) &&
      Number.isInteger(raw.spawnErrno) && Number.isInteger(raw.interrupted) && typeof raw.timedOut === 'boolean' &&
      (raw.status === null || (Number.isInteger(raw.status) && raw.status >= 0 && raw.status <= 255)) &&
      (raw.signal === null || (Number.isInteger(raw.signal) && raw.signal > 0));
    if (!valid || raw.cleanup !== true || raw.cleanupErrno !== 0 || owner.status !== 0 || owner.signal || spawnError || watchdogExpired) failures.push('Unverified command cleanup');
    if (valid && raw.status === null && raw.signal === null && raw.spawnErrno === 0) failures.push('Missing child outcome');
    const signame = valid && raw.signal !== null ? Object.entries(constants.signals).find(([,number]) => number === raw.signal)?.[0] ?? 'UNKNOWN_SIGNAL' : null;
    return {status:valid ? raw.status : null, signal:signame, error:spawnError ?? (valid && raw.spawnErrno ? 'Command exec errno ' + raw.spawnErrno : failures.length ? failures.join('; ') : null), timedOut:watchdogExpired || raw?.timedOut === true, interrupted:signal?.aborted === true || (valid && raw.interrupted !== 0), cleanup:failures.length === 0, cleanupErrors:failures, supervisor:owner};
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
