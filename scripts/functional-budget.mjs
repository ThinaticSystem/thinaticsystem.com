import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';

// SAFETY: a new invocation owns a new receipt; an earlier PASS can never be reused as this attempt.
const root=process.cwd();
const outputRoot=resolve('.artifacts/functional-budget');
mkdirSync(outputRoot,{recursive:true});
const output=join(mkdtempSync(join(outputRoot,'run-')),'result.json');
let result={schema:'thinaticsystem/functional-budget-result/v1',valid:false,verdict:'INVALID_EVIDENCE',overall:'FAIL',releaseAuthorization:'NOT_GRANTED'};
try {
 const {values}=parseArgs({options:{'paired-run':{type:'string'},'paired-exit':{type:'string'}},allowPositionals:false});
 if(!values['paired-run']||!values['paired-exit']) throw new Error('Required: --paired-run <complete run directory> --paired-exit <owned paired command.exit.json>');
 const {inspectFunctionalBudget}=await import('./functional-budget-evidence.mjs');
 result=inspectFunctionalBudget({root,directory:resolve(values['paired-run']),pairedExitPath:resolve(values['paired-exit'])});
} catch(error) {
 result={...result,error:error instanceof Error?error.message:String(error)};
}
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,output},null,2));
// NOTE: v1 has deliberately unmeasured scopes. No invocation of this version authorizes release.
process.exitCode=1;
