import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CANDIDATE_BRANCH = 'chore/modernization-renovate';
export const PAGES_SHA_MARKER = 'pages-commit-sha.txt';
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const APPLICATION_ROOT = resolve('dist/app');
const BROWSER_ROOT = resolve(APPLICATION_ROOT, 'browser');

/**
 * Validate the build identity that Pages supplies before candidate-only layout changes.
 * @param {{isPages: boolean, branch: string | undefined, commitSha: string | undefined, headSha: string}} identity
 * @returns {string | null}
 */
export function validatePagesBuildIdentity(identity) {
  if (!identity.isPages) return null;
  if (identity.branch !== CANDIDATE_BRANCH) throw new Error(`Pages branch must be ${CANDIDATE_BRANCH}`);
  if (typeof identity.commitSha !== 'string' || !SHA_PATTERN.test(identity.commitSha)) {
    throw new Error('Pages commit SHA must be a 40-character hexadecimal Git SHA');
  }
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

/** Copy Angular's browser subtree to Pages' configured root and add an exact-SHA marker. */
export function createPagesRoot({browserRoot, outputRoot, commitSha}) {
  if (!SHA_PATTERN.test(commitSha)) throw new Error('Pages commit SHA is invalid');
  validateBrowserOutput(browserRoot);
  mkdirSync(outputRoot, {recursive: true});
  cpSync(browserRoot, outputRoot, {recursive: true, force: true});
  rmSync(browserRoot, {recursive: true, force: true});
  writeFileSync(resolve(outputRoot, PAGES_SHA_MARKER), `${commitSha}\n`, {encoding: 'utf8', flag: 'wx'});
  validatePagesRoot(outputRoot, commitSha);
}

function buildAngular(args) {
  const cli = resolve('node_modules/@angular/cli/bin/ng.js');
  const result = spawnSync(process.execPath, [cli, 'build', ...args], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Angular build terminated by ${result.signal}`);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

function runBuild() {
  const isPages = process.env.CF_PAGES === '1';
  const commitSha = validatePagesBuildIdentity({
    isPages,
    branch: process.env.CF_PAGES_BRANCH,
    commitSha: process.env.CF_PAGES_COMMIT_SHA,
    headSha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  });
  if (commitSha !== null) rmSync(resolve(APPLICATION_ROOT, PAGES_SHA_MARKER), {force: true});
  buildAngular(process.argv.slice(2));
  if (process.exitCode && process.exitCode !== 0) return;
  if (commitSha !== null) createPagesRoot({browserRoot: BROWSER_ROOT, outputRoot: APPLICATION_ROOT, commitSha});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runBuild();
