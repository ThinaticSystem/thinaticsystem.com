import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, basename} from 'node:path';
import {gzipSync, brotliCompressSync, constants} from 'node:zlib';

const distRoot = process.env.DIST_ROOT ?? 'dist/app/browser';
const baselinePath = process.env.PERFORMANCE_BASELINE ?? 'test/performance-baseline.json';
const browserEvidencePath = process.env.EVIDENCE_OUTPUT ?? '.artifacts/browser-smoke.json';
const outputPath = process.env.PERFORMANCE_OUTPUT ?? '.artifacts/performance.json';

function fail(message) {
  throw new Error(message);
}

function initialFiles() {
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
  return evidence;
}

function main() {
  if (!existsSync(join(distRoot, 'index.html'))) fail(`Build artifact missing: ${join(distRoot, 'index.html')}`);
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const evidence = readEvidence();
  const initial = initialFiles();
  const sizeComparison = {baseline: baseline.initial, candidate: initial.total, deltas: Object.fromEntries(Object.keys(baseline.initial).map((key) => [key, initial.total[key] - baseline.initial[key]]))};
  const regressions = [];
  for (const [name, expected] of Object.entries(baseline.journeys)) {
    const observed = evidence.aggregate.journeys[name];
    if (!observed) {
      regressions.push(`Missing journey evidence: ${name}`);
      continue;
    }
    if (observed.requestCounts.some((count) => count > expected.requestCount)) regressions.push(`Request count regression in ${name}: ${JSON.stringify(observed.requestCounts)} > ${expected.requestCount}`);
  }
  for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes']) {
    if (initial.total[key] > baseline.initial[key]) regressions.push(`Initial ${key} regression: ${initial.total[key]} > ${baseline.initial[key]}`);
  }
  const result = {
    schema: 'thinaticsystem-modernization/performance-check/v1',
    baseSha: baseline.baseSha,
    candidateHead: process.env.CANDIDATE_SHA ?? 'not supplied',
    sizeComparison,
    journeys: evidence.aggregate.journeys,
    policy: baseline.policy,
    regressions,
    verdict: regressions.length === 0 ? 'PASS: size/request non-regression; timing retained as three-repeat lab evidence' : 'FAIL',
  };
  mkdirSync(join(outputPath, '..'), {recursive: true});
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (regressions.length) process.exitCode = 1;
}

try { main(); } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
