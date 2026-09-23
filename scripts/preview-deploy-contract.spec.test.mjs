import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const workflowPath = '.github/workflows/ci.yml';
const requiredVerifyGates = [
  'Typecheck',
  'Performance policy version contract',
  'Preview delivery contract',
  'Lint',
  'Unit tests',
  'Known-defect contract fixtures',
  'Known-defect raw gate',
  'Functional performance budget contract fixtures',
  'Paired performance contract fixtures',
  'Production build',
  'Current performance contract fixtures',
  'Actual-browser recorder canaries',
  'Native menu motion regression',
  'Candidate browser functionality and accessibility',
  'Calibrated same-runner current performance',
  'TypeDoc',
  'Fixture-only local HTTP contract smoke',
];

test('Given Pages Git integration owns candidate delivery when CI runs then workflow retains verification gates without a deploy or secret-bearing job', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /jobs:\n  verify:/, 'verification job remains');
  assert.doesNotMatch(workflow, /^  (?:preview|deploy):/m, 'legacy upload job is removed');
  assert.doesNotMatch(workflow, /wrangler-action|wrangler pages deploy|pages deploy|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|secrets\./i, 'workflow has no deployment action or Cloudflare secret privilege');
  assert.match(workflow, /permissions:\n  contents: read\n/, 'workflow retains read-only repository permissions');
  const verifyJob = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('\n  preview:') > -1 ? workflow.indexOf('\n  preview:') : undefined);
  for (const gate of requiredVerifyGates) assert.ok(verifyJob.includes(`name: ${gate}`), `verification gate remains: ${gate}`);
  assert.match(verifyJob, /run: corepack pnpm run test:performance-policy/);
  assert.match(verifyJob, /run: corepack pnpm run test:preview-contract/);
  assert.match(verifyJob, /run: corepack pnpm run perf:current/);
  assert.match(verifyJob, /dist\/app\/browser\//, 'normal CI artifact layout is unchanged');
});
