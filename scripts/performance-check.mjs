import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync, brotliCompressSync, constants} from 'node:zlib';

const distRoot = process.env.DIST_ROOT ?? 'dist/app/browser';
const baselinePath = process.env.PERFORMANCE_BASELINE ?? 'test/performance-baseline.json';
const browserEvidencePath = process.env.EVIDENCE_OUTPUT ?? '.artifacts/browser-smoke.json';
const outputPath = process.env.PERFORMANCE_OUTPUT ?? '.artifacts/performance.json';

function fail(message) {
  throw new Error(message);
}

export function collectInitialAssets(distRoot) {
  const index = readFileSync(join(distRoot, 'index.html'), 'utf8');
  const references = [...index.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1].split('?')[0]);
  const files = [...new Set(references)].map((reference) => {
    const file = join(distRoot, reference.replace(/^\//, ''));
    if (!existsSync(file)) fail(`Initial artifact referenced by index is missing: ${file}`);
    const bytes = readFileSync(file);
    return {
      file: basename(file),
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, {level: 9, mtime: 0}).length,
      brotliBytes: brotliCompressSync(bytes, {params: {[constants.BROTLI_PARAM_QUALITY]: 11}}).length,
    };
  });
  return {files, total: files.reduce((total, file) => ({rawBytes: total.rawBytes + file.rawBytes, gzipBytes: total.gzipBytes + file.gzipBytes, brotliBytes: total.brotliBytes + file.brotliBytes}), {rawBytes: 0, gzipBytes: 0, brotliBytes: 0})};
}

function readEvidence() {
  if (!existsSync(browserEvidencePath)) fail(`Browser evidence is missing: ${browserEvidencePath}`);
  const evidence = JSON.parse(readFileSync(browserEvidencePath, 'utf8'));
  if (!Number.isInteger(evidence.repeatCount) || evidence.repeatCount < 3) fail('Performance evidence requires at least three browser repeats.');
  if (!evidence.aggregate?.journeys) fail('Browser evidence does not contain aggregate journey measurements.');
  if (!['thinaticsystem-modernization/browser-smoke/v3', 'thinaticsystem-modernization/browser-smoke/v4'].includes(evidence.schema)) fail('Performance evidence must come from the timing-only browser-smoke v3 harness.');
  const substrate = evidence.timingSubstrate;
  if (substrate?.fixture !== 'owned synthetic CMS/API data' || substrate.reducedMotion !== 'reduce' || substrate.readiness !== (evidence.schema.endsWith('/v4') ? 'loading image fade then finite motion settled before timer stop' : 'waitForVisualReady before timer stop') || substrate.accessibility !== 'axe scan after timer stop' || substrate.server !== 'loopback static artifact server') fail('Performance evidence does not declare the required shared timing substrate.');
  if (!Array.isArray(evidence.runs) || evidence.runs.length !== evidence.repeatCount) fail('Performance evidence run count does not match repeatCount.');
  for (const [name, journey] of Object.entries(evidence.aggregate.journeys)) {
    if (!Array.isArray(journey.runs) || journey.runs.length !== evidence.repeatCount || !Array.isArray(journey.requestCounts) || journey.requestCounts.length !== evidence.repeatCount || !Array.isArray(journey.resourceSummaries) || journey.resourceSummaries.length !== evidence.repeatCount) fail(`Incomplete repeated evidence for ${name}.`);
  }
  return evidence;
}

function main() {
  if (!existsSync(join(distRoot, 'index.html'))) fail(`Build artifact missing: ${join(distRoot, 'index.html')}`);
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const evidence = readEvidence();
  if (evidence.schema.endsWith('/v4') || baseline.schema?.endsWith('/v4')) {
    if (baseline.schema !== evidence.schema || JSON.stringify(baseline.timingSubstrate) !== JSON.stringify(evidence.timingSubstrate) || baseline.browser?.version !== evidence.browser?.version) fail('Visible-readiness evidence needs a fresh paired v4 baseline with identical browser/font/theme/readiness. Supply PERFORMANCE_BASELINE; the historical v3 baseline is not comparable.');
  }
  const initial = collectInitialAssets(distRoot);
  const sizeComparison = {baseline: baseline.initial, candidate: initial.total, deltas: Object.fromEntries(Object.keys(baseline.initial).map((key) => [key, initial.total[key] - baseline.initial[key]]))};
  const regressions = [];
  for (const [name, expected] of Object.entries(baseline.journeys)) {
    const observed = evidence.aggregate.journeys[name];
    if (!observed) {
      regressions.push(`Missing journey evidence: ${name}`);
      continue;
    }
    if (observed.requestCounts.some((count) => count > expected.requestCount)) regressions.push(`Request count regression in ${name}: ${JSON.stringify(observed.requestCounts)} > ${expected.requestCount}`);
    const timingThreshold = baseline.policy.timing.maxRelativeRegression;
    if (!Number.isFinite(timingThreshold) || timingThreshold < 0) fail('Baseline timing policy must define a non-negative relative regression threshold.');
    if (!Number.isFinite(observed.medianInMs) || observed.medianInMs > expected.medianInMs * (1 + timingThreshold)) regressions.push(`Timing regression or inconclusive measurement in ${name}: median ${observed.medianInMs}ms > ${expected.medianInMs}ms baseline by more than ${timingThreshold * 100}%.`);
    const expectedResources = baseline.routeResources?.[name];
    if (expectedResources && (!observed.resourceSummaries?.length || observed.resourceSummaries.some((resourceSummary) => !resourceSummary || resourceSummary.decodedBodySizeInBytes > expectedResources.rawBytes || resourceSummary.count > expectedResources.requestCount))) regressions.push(`Lazy-route resource regression in ${name}: observed ${JSON.stringify(observed.resourceSummaries)} > ${JSON.stringify(expectedResources)}`);
  }
  for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes']) {
    if (initial.total[key] > baseline.initial[key]) regressions.push(`Initial ${key} regression: ${initial.total[key]} > ${baseline.initial[key]}`);
  }
  const result = {
    schema: 'thinaticsystem-modernization/performance-check/v1',
    baseSha: baseline.baseSha,
    candidateHead: process.env.CANDIDATE_SHA ?? 'not supplied',
    timingSubstrate: evidence.timingSubstrate,
    sizeComparison,
    journeys: evidence.aggregate.journeys,
    policy: baseline.policy,
    timingVerdict: regressions.some((regression) => regression.startsWith('Timing regression')) ? 'INCONCLUSIVE_OR_FAIL' : 'COMPARABLE_WITHIN_PRESET_NOISE_RULE',
    regressions,
    verdict: regressions.length === 0 ? 'PASS: size/request non-regression; timing retained as repeated local-lab evidence' : 'FAIL',
  };
  mkdirSync(join(outputPath, '..'), {recursive: true});
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (regressions.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try { main(); } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
