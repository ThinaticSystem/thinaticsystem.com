import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CANDIDATE_BRANCH = 'chore/modernization-renovate';
export const PAGES_SHA_MARKER = 'pages-commit-sha.txt';
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const APPLICATION_ROOT = resolve('dist/app');
const PATRONS_PROXY_SOURCE = resolve('scripts/pages-patrons-proxy.mjs');
export const PATRONS_WORKER_FILENAME = '_worker.js';
export const PAGES_ROUTES_FILENAME = '_routes.json';
const BROWSER_ROOT = resolve(APPLICATION_ROOT, 'browser');

/**
 * Validate the build identity that Pages supplies before candidate-only layout changes.
 * @param {{isPages: boolean, branch: string | undefined, localBranch: string | undefined, commitSha: string | undefined, headSha: string}} identity
 * @returns {string | null}
 */
export function validatePagesBuildIdentity(identity) {
  if (!identity.isPages) return null;
  const localBranch = typeof identity.localBranch === 'string' && identity.localBranch !== '' ? identity.localBranch : null;
  if (localBranch !== null && identity.branch !== localBranch) throw new Error('Pages branch metadata does not match the checked-out branch');
  if (localBranch !== null && localBranch !== CANDIDATE_BRANCH) {
    if (identity.branch === CANDIDATE_BRANCH) throw new Error('Candidate Pages metadata does not match the checked-out branch');
    return null;
  }
  if (identity.branch !== CANDIDATE_BRANCH) {
    if (localBranch === CANDIDATE_BRANCH) throw new Error('Pages branch must be ' + CANDIDATE_BRANCH);
    return null;
  }
  if (typeof identity.commitSha !== 'string' || !SHA_PATTERN.test(identity.commitSha)) throw new Error('Pages commit SHA must be a 40-character hexadecimal Git SHA');
  if (identity.commitSha !== identity.headSha) throw new Error('Pages commit SHA does not match checked-out HEAD');
  return identity.commitSha;
}

function localAssetPaths(indexHtml) {
  const paths = [];
  for (const match of indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
    const pathname = new URL(reference, 'https://pages.invalid/').pathname;
    const asset = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    if (asset) paths.push(asset);
  }
  return paths;
}

/** Convert only relative modulepreload links to root-relative URLs for Pages-generated Link headers. */
export function normalizeModulePreloadHrefs(indexHtml) {
  return indexHtml.replace(/<link\b[^>]*>/gi, tag => {
    const relation = tag.match(/\brel=["']([^"']+)["']/i)?.[1].toLowerCase().split(/\s+/) ?? [];
    if (!relation.includes('modulepreload')) return tag;
    return tag.replace(/\bhref=(["'])([^"']+)\1/i, (attribute, quote, reference) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(reference)) return attribute;
      const url = new URL(reference, 'https://pages.invalid/');
      if (url.origin !== 'https://pages.invalid') return attribute;
      return 'href=' + quote + url.pathname + url.search + url.hash + quote;
    });
  });
}

/** Validate Angular's browser output before publishing it as the Pages root. */
export function validateBrowserOutput(browserRoot) {
  const indexPath = resolve(browserRoot, 'index.html');
  const indexHtml = readFileSync(indexPath, 'utf8');
  const assets = localAssetPaths(indexHtml);
  if (!assets.some((asset) => /\.m?js$/i.test(asset))) throw new Error('Angular output index has no local JavaScript entry asset');
  if (!assets.some((asset) => /\.css$/i.test(asset))) throw new Error('Angular output index has no local stylesheet asset');
  for (const asset of assets) {
    const assetPath = resolve(browserRoot, asset);
    if (!assetPath.startsWith(resolve(browserRoot) + sep)) throw new Error(`Angular output asset escapes browser root: ${asset}`);
    if (!statSync(assetPath, {throwIfNoEntry: false})?.isFile()) throw new Error(`Angular output asset is missing: ${asset}`);
  }
  return indexHtml;
}

/** Validate the public Pages root and its exact-source marker. */
export function validatePagesRoot(root, expectedSha) {
  if (!SHA_PATTERN.test(expectedSha)) throw new Error('Expected Pages SHA must be a 40-character hexadecimal Git SHA');
  const marker = readFileSync(resolve(root, PAGES_SHA_MARKER), 'utf8').trim();
  if (!SHA_PATTERN.test(marker) || marker !== expectedSha) throw new Error('Pages root commit marker is missing, invalid, or stale');
  validateBrowserOutput(root);
}

/** Emit the candidate-only Pages worker and its exact invocation route. */
export function createPagesRuntimeFiles(outputRoot) {
  const proxySource = readFileSync(PATRONS_PROXY_SOURCE, 'utf8');
  if (!proxySource.includes('export async function handlePagesRequest') || /\bexport\s+default\b/.test(proxySource)) {
    throw new Error('Pages proxy policy must expose only its named handler');
  }
  const worker = `${proxySource}\nexport default {\n  fetch(request, env) {\n    return handlePagesRequest(request, env);\n  },\n};\n`;
  writeFileSync(resolve(outputRoot, PATRONS_WORKER_FILENAME), worker, {encoding: 'utf8', flag: 'wx'});
  writeFileSync(resolve(outputRoot, PAGES_ROUTES_FILENAME), JSON.stringify({version: 1, include: ['/workers/patrons'], exclude: []}, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
}

/** Copy Angular's browser subtree to Pages' configured root and add an exact-SHA marker. */
export function createPagesRoot({browserRoot, outputRoot, commitSha}) {
  if (!SHA_PATTERN.test(commitSha)) throw new Error('Pages commit SHA is invalid');
  const indexHtml = validateBrowserOutput(browserRoot);
  const normalizedIndexHtml = normalizeModulePreloadHrefs(indexHtml);
  if (normalizedIndexHtml !== indexHtml) writeFileSync(resolve(browserRoot, 'index.html'), normalizedIndexHtml, 'utf8');
  mkdirSync(outputRoot, {recursive: true});
  cpSync(browserRoot, outputRoot, {recursive: true, force: true});
  rmSync(browserRoot, {recursive: true, force: true});
  writeFileSync(resolve(outputRoot, PAGES_SHA_MARKER), `${commitSha}\n`, {encoding: 'utf8', flag: 'wx'});
  validatePagesRoot(outputRoot, commitSha);
  createPagesRuntimeFiles(outputRoot);
}

export function validateCandidateBuildConfiguration(args) {
  if (args.some((argument) => argument === '-c' || argument.startsWith('-c=') || argument.startsWith('--configuration'))) {
    throw new Error('Candidate Pages builds use the locked preview configuration');
  }
}

function buildAngular(args, candidatePreview) {
  const cli = resolve('node_modules/@angular/cli/bin/ng.js');
  if (candidatePreview) validateCandidateBuildConfiguration(args);
  const configuration = candidatePreview ? ['--configuration=preview'] : [];
  const result = spawnSync(process.execPath, [cli, 'build', ...configuration, ...args], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Angular build terminated by ${result.signal}`);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

function runBuild() {
  const isPages = process.env.CF_PAGES === '1';
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  // A detached checkout has no symbolic branch identity; refs that happen to point at HEAD cannot establish one.
  // In detached mode CF_PAGES_BRANCH selects behavior, while candidate mode still requires an exact HEAD SHA.
  const localBranch = execFileSync('git', ['branch', '--show-current'], {encoding: 'utf8'}).trim();
  const commitSha = validatePagesBuildIdentity({
    isPages,
    branch: process.env.CF_PAGES_BRANCH,
    localBranch,
    commitSha: process.env.CF_PAGES_COMMIT_SHA,
    headSha,
  });
  if (commitSha !== null) rmSync(resolve(APPLICATION_ROOT, PAGES_SHA_MARKER), {force: true});
  buildAngular(process.argv.slice(2), commitSha !== null);
  if (process.exitCode && process.exitCode !== 0) return;
  if (commitSha !== null) createPagesRoot({browserRoot: BROWSER_ROOT, outputRoot: APPLICATION_ROOT, commitSha});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runBuild();
