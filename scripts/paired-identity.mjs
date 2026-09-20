import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const generated=/^(?:\.git|\.artifacts|node_modules|dist|out-tsc|coverage|tmp|bazel-out|\.angular)(?:\/|$)/;
const secret=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|.*\.(?:pem|key|p12)|id_rsa|id_ed25519)$/i;
function manifest(root,paths) {
 const files=[...new Set(paths)].sort().map(path=>{
  if(secret.test(path)) throw new Error('Refusing potential secret in source identity: '+path);
  const absolute=join(root,path);
  if(!existsSync(absolute)) return {path,kind:'missing'};
  const stat=lstatSync(absolute);
  if(!stat.isFile()) throw new Error('Unsupported source kind (symlinks cannot prove external bytes): '+path);
  const bytes=readFileSync(absolute);
  return {path,kind:'file',mode:stat.mode&0o777,sizeInBytes:bytes.length,sha256:digest(bytes)};
 });
 return {schema:'thinaticsystem/source-manifest/v1',files,sha256:digest(JSON.stringify(files))};
}
/** Full Git-known + nonignored untracked source identity, not HEAD-only or a handpicked input list.
 * Hashes only; potential secret filenames fail closed rather than publishing their bytes.
 */
export function captureSourceIdentity(root) {
 const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',timeout:30_000}).split('\0').filter(p=>p&&!generated.test(p));
 return manifest(root,paths);
}
/** Hash every actual output asset; never follow symlinks outside the owned build. */
export function captureBuildIdentity(root) {
 if(!existsSync(join(root,'index.html'))) throw new Error('Missing build index');
 const paths=[];
 const visit=prefix=>{for(const entry of readdirSync(join(root,prefix),{withFileTypes:true})){const path=prefix?prefix+'/'+entry.name:entry.name;if(entry.isDirectory())visit(path);else if(entry.isFile())paths.push(path);else throw new Error('Unsupported build asset: '+path);}};
 visit('');return manifest(root,paths);
}
