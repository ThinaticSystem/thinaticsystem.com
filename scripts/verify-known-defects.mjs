import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateKnownDefectRun} from './known-defect-contract.mjs';
import {validateResolvedDebtRun} from './resolved-debt-contract.mjs';

const resultPath = '.artifacts/known-defects-result.json';
rmSync(resultPath, {force: true});
const manifest = JSON.parse(readFileSync('test/known-defects.json', 'utf8'));
const resolved = Array.isArray(manifest.cases) && manifest.cases.length === 0 && manifest.resolvedCheck !== undefined;
const openSpecs = [];
function discover(path) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in known-defect discovery');
    const next = path+'/'+entry.name;
    if (entry.isDirectory()) discover(next);
    else if (entry.name.endsWith('.spec.ts')) openSpecs.push(next);
  }
}
if (resolved) discover('src/known-defects');
mkdirSync('.artifacts', {recursive: true});
const reportPath = '.artifacts/known-defects-report.json';
rmSync(reportPath, {force: true});
const result = spawnSync(
  'corepack',
  ['pnpm', 'exec', 'ng', 'run', 'thinaticsystem-com:known-defects', '--watch=false', '--progress=false', ...(resolved ? ['--include=src/app/pipes/sanitize-html.pipe.spec.ts'] : [])],
  {encoding: 'utf8'},
);
const rawOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
writeFileSync('.artifacts/known-defects.raw.log', rawOutput);
process.stdout.write(rawOutput);
let report = null;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  report = null;
}

let errors;
try {
  errors = (resolved ? validateResolvedDebtRun : validateKnownDefectRun)({
  openSpecs,
  manifest,
  status: result.status,
  error: result.error,
  signal: result.signal,
  report,
  stderr: result.stderr ?? '',
  });
} catch (error) {
  errors = ['Validator failed unexpectedly: '+String(error)];
}

writeFileSync(resultPath, `${JSON.stringify({
  gateStatus: errors.length === 0 ? 'PASS' : 'FAIL',
  status: result.status,
  signal: result.signal,
  error: result.error?.message ?? null,
  validationErrors: errors,
  report,
}, null, 2)}\n`);

if (errors.length > 0) {
  for (const error of errors) console.error(`Known-defect gate error: ${error}`);
  process.exit(1);
}

console.log(resolved ? 'Known-defect gate: zero open cases; four ordinary security regressions actually passed with no runner/setup failures.' : `Known-defect gate observed ${manifest.cases.length} registered assertion failure(s); no runner/setup failure detected.`);
