import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export const controlSelection = Object.freeze({"path":"test/paired-baseline-control-v2.json","sha256":"60320084564717481d1c20db4c413fe79f6ad751adb452ebc81ce7c2a83a0e28"});
const parentSha256 = '23aa45dd621b4ae385dd127515e9115f3952ca79b0c1ae415978304fbf616be3';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
/** Only this reviewed content-addressed control is selectable; no latest/union/auto-enrollment. */
export function readHistoricalControl(selection, read = readFileSync) {
 if (!isDeepStrictEqual(selection,controlSelection)) throw new Error('Explicit reviewed historical control path and SHA256 required');
 const bytes=read(selection.path);
 if(digest(bytes)!==selection.sha256) throw new Error('Historical control content changed');
 const control=JSON.parse(bytes);
 if(control.parent.sha256!==parentSha256 || digest(read(control.parent.path))!==parentSha256) throw new Error('Immutable parent control changed');
 for(const [path,expected] of Object.entries(control.inputHashes)) if(digest(read(path))!==expected) throw new Error('Historical control substrate changed: '+path);
 return control;
}
/** Actual child-reported runtime and PM identity, checked before frozen install. */
export function validateControlRuntime(control,runtime) {
 const errors=[];
 for(const key of ['node','corepack','pnpm','lockSha256']) if(runtime?.[key]!==control.baseline[key]) errors.push('Baseline '+key+' mismatch');
 if(!runtime?.expectedExecPath || runtime.execPath!==runtime.expectedExecPath) errors.push('Baseline executable mismatch');
 return errors;
}
/** Measurement remains the candidate driver on both sides; no incomplete-result suppression or gate. */
export function validateMeasurementControl(control,evidence) {
 const errors=[];
 if(evidence?.browser?.version!==control.measurement.chromium) errors.push('Historical control Chromium mismatch');
 for(const key of ['node','playwright','axe']) if(evidence?.toolchain?.[key]!==control.measurement[key]) errors.push('Measurement '+key+' mismatch');
 return errors;
}
