import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateKnownDefectRun} from './known-defect-contract.mjs';

const manifest = JSON.parse(readFileSync('test/known-defects.json', 'utf8'));
mkdirSync('.artifacts', {recursive: true});
const reportPath = '.artifacts/known-defects-report.json';
const result = spawnSync(
  'corepack',
  ['pnpm', 'exec', 'ng', 'run', 'thinaticsystem-com:known-defects', '--watch=false', '--progress=false', '--reporters=json', `--output-file=${reportPath}`],
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

const errors = validateKnownDefectRun({
  manifest,
  status: result.status,
  error: result.error,
  signal: result.signal,
  report,
  stderr: result.stderr ?? '',
});

writeFileSync('.artifacts/known-defects-result.json', `${JSON.stringify({
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

console.log(`Known-defect gate observed ${manifest.cases.length} registered assertion failure(s); no runner/setup failure detected.`);
