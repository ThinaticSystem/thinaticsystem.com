import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateKnownDefectRun} from './known-defect-contract.mjs';

const manifest = JSON.parse(readFileSync('test/known-defects.json', 'utf8'));
const result = spawnSync(
  'corepack',
  ['pnpm', 'exec', 'ng', 'run', 'thinaticsystem-com:known-defects', '--watch=false', '--progress=false'],
  {encoding: 'utf8', shell: true},
);
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
process.stdout.write(output);

const errors = validateKnownDefectRun({
  manifest,
  status: result.status,
  error: result.error,
  output,
});

if (errors.length > 0) {
  for (const error of errors) console.error(`Known-defect gate error: ${error}`);
  process.exit(1);
}

console.log(`Known-defect gate observed ${manifest.cases.length} registered assertion failure(s); no runner/setup failure detected.`);
