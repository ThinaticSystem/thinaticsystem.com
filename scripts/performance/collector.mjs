import {createServer} from 'node:http';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join, extname, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {browserEnvironment} from '../browser-environment.mjs';
import {captureBuildIdentity} from '../paired-identity.mjs';
import {fixtureFor, fixtureSha256, fixtureNotes, spaPaths, articleTitle, articleBodyText, releaseTitle, releaseBodyText} from './fixtures.mjs';
import {initializeTheme, installPageRecorder, attachRequestRecorder, readEndpoint} from './recorder.mjs';

const desktop = {width: 1280, height: 900};
const mobile = {width: 375, height: 812};
const themeName = 'ライトモードとダークモードを切り替えます';
const share = {tags: 'button', name: 'このページのURLをコピーします'};
const heading = text => ({tags: 'h1,h2,h3,[role="heading"]', text});
const link = name => ({tags: 'a,button', name});
export const endpoints = {
  // COMPAT: Baseline uses navigation buttons and literal ** in Markdown image alt;
  // both observed names identify the same complete fixture image, not a quality waiver.
  home: {path: '/', targets: [heading('ThinaticSystem'), {tags: 'p', text: 'Synthetic notice'}, link('もっと詳しく'), link('楽曲一覧')]},
  article: {path: '/blog/article/1', targets: [heading(articleTitle), {tags: 'p', text: articleBodyText}, {tags: 'strong', text: 'Formatted fixture'}, link('Reader reference'), {tags: 'img', names: ['Fixture illustration', '**Fixture illustration**']}, share]},
  blog: {path: '/blog', targets: [heading('Blog'), {tags: 'a', containsText: articleTitle}]},
  discography: {path: '/discography', targets: [heading('Discography'), heading(releaseTitle), {tags: 'img', name: 'Synthetic artwork'}]},
  detail: {path: '/discography/1', targets: [heading(releaseTitle), {tags: 'p', text: releaseBodyText}, {tags: 'p', text: 'Fixture composer'}, {tags: 'img', name: 'Synthetic artwork'}, share]},
  menuOpen: {main: false, targets: [{tags: 'button', name: 'メニューを閉じます'}, link('Blog')]},
  menuClosed: {main: false, targets: [{tags: 'button', name: 'メニューを開きます'}], absent: [{tags: 'button', name: 'メニューを閉じます'}]},
  theme: {main: false, theme: 'dark', targets: [{tags: 'button', name: themeName}]},
};
const contentType = path => ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'})[extname(path)] ?? 'application/octet-stream';

/** Loopback-only, exact build-file and SPA inventory; no arbitrary extensionless fallback. */
export async function serveBuild(distRoot, manifest, errors) {
  const files = new Set(manifest.files.filter(file => file.kind === 'file').map(file => '/' + file.path));
  const allowedPath = path => files.has(path) || spaPaths.includes(path);
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method !== 'GET' || url.search || !allowedPath(url.pathname)) {
        errors.push(`Rejected local request: ${request.method} ${url.pathname}${url.search}`);
        response.writeHead(404); response.end('Not in measurement inventory'); return;
      }
      const path = files.has(url.pathname) ? url.pathname.slice(1) : 'index.html';
      const body = readFileSync(join(distRoot, path));
      response.writeHead(200, {'content-type': contentType(path), 'cache-control': 'no-store'});
      response.end(body);
    } catch (error) { errors.push(`Static server: ${String(error)}`); response.writeHead(500); response.end(); }
  });
  await new Promise((done, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', done);});
  return {origin: `http://127.0.0.1:${server.address().port}`, allowedPath,
    async close() {server.closeAllConnections(); await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));}};
}

function harnessIdentity() {
  const root = dirname(fileURLToPath(import.meta.url));
  const hash = createHash('sha256');
  for (const file of ['collector.mjs', 'recorder.mjs', 'fixtures.mjs', '../browser-environment.mjs', '../paired-identity.mjs']) hash.update(file).update('\0').update(readFileSync(join(root, file)));
  return hash.digest('hex');
}

/** Own one isolated observation. Failures retain partial evidence and never invent readiness/bytes. */
export async function collectPerformance({distRoot, outputDirectory, side, attemptOrdinal, executablePath = process.env.BROWSER_EXECUTABLE_PATH ?? chromium.executablePath()}) {
  if (!['baseline', 'candidate'].includes(side) || !Number.isInteger(attemptOrdinal) || attemptOrdinal < 0) throw new Error('Invalid observation identity');
  const output = resolve(outputDirectory);
  mkdirSync(output, {recursive: true});
  const errors = [];
  const diagnostics = [];
  const result = {schema: 'thinaticsystem/performance-observation/v1', side, attemptOrdinal,
    browser: {version: null, executablePath}, fixtureSha256, harnessSha256: harnessIdentity(), buildSha256: null,
    profile: {id: 'desktop-normal-loopback-v1', viewport: desktop, reducedMotion: 'no-preference', httpCache: 'routed-disabled', cpuRate: 1, network: 'loopback-fixture'},
    journeys: [], setup: [], errors, cleanup: false, notes: fixtureNotes};
  let browser = null, server = null;
  let contextNumber = 0;
  const contexts = new Set();
  async function open(initial, viewport = desktop) {
    const context = await browser.newContext({viewport, reducedMotion: 'no-preference', colorScheme: 'light', serviceWorkers: 'block'});
    const requests = attachRequestRecorder(context, {prefix: `context-${++contextNumber}`, errors});
    const owned = {context, requests, page: null, viewport};
    contexts.add(owned);
    requests.begin(initial.id);
    await context.route('**/*', async route => {
      const request = route.request();
      const fixture = fixtureFor(request.url(), request.method());
      if (fixture) return route.fulfill(fixture);
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.origin === server.origin && !url.search && server.allowedPath(url.pathname)) return route.continue();
      errors.push(`Unmatched network fixture: ${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(initializeTheme);
    await context.addInitScript(installPageRecorder, {...initial, clockOrigin: 'navigation'});
    owned.page = await context.newPage();
    return owned;
  }
  async function finish(owned, id, entryKind, destination = result.journeys) {
    const endpoint = await readEndpoint(owned.page, id);
    const resources = await owned.requests.finish(endpoint.timeOrigin + endpoint.endInMs);
    destination.push({id, entryKind, clockOrigin: endpoint.clockOrigin, elapsedInMs: endpoint.elapsedInMs, ready: endpoint.ready,
      viewport: owned.viewport, readinessWitness: endpoint.witness, pageClock: endpoint, resources, requestCount: resources.length});
  }
  async function cold(id, spec, viewport = desktop, destination = result.journeys) {
    const owned = await open({id, spec}, viewport);
    await owned.page.goto(server.origin + spec.path, {waitUntil: 'domcontentloaded', timeout: 20_000});
    await finish(owned, id, 'cold', destination);
    return owned;
  }
  async function action(owned, id, spec, target, entryKind = 'spa-warm', destination = result.journeys) {
    // NOTE: Driver setup and locator retries precede the trusted-event timestamp.
    // COMPAT: Frozen historical navigation used named buttons; candidate uses links.
    // The user intent/clock is identical; candidate anchor semantics remain in a11y QA.
    const locator = target.role === 'text' ? owned.page.getByText(target.name, {exact: true}).first()
      : target.role === 'link' ? owned.page.getByRole('link', {name: target.name, exact: true}).or(owned.page.getByRole('button', {name: target.name, exact: true})).first()
      : owned.page.getByRole(target.role, {name: target.name, exact: true}).first();
    await locator.waitFor({state: 'visible', timeout: 10_000});
    owned.requests.begin(id);
    await owned.page.evaluate(input => window.__performanceRecorder.arm(input), {id, spec, clockOrigin: 'trusted-input', trigger: {event: 'click', name: target.name}});
    await locator.click({timeout: 10_000});
    await finish(owned, id, entryKind, destination);
  }
  async function close(owned) {
    // NOTE: Final-context pixels only; no later measured actions share this context.
    const id = `qa.final-context-${contextNumber}`;
    owned.requests.begin(id);
    const screenshot = `${id}.png`;
    await owned.page.screenshot({path: join(output, screenshot), fullPage: true});
    const resources = await owned.requests.finish(Number.NEGATIVE_INFINITY);
    diagnostics.push({id, kind: 'diagnostic-screenshot', screenshot, resources, requestCount: resources.length});
    await owned.requests.close(); contexts.delete(owned);
  }
  try {
    const build = captureBuildIdentity(resolve(distRoot));
    result.buildSha256 = build.sha256;
    server = await serveBuild(resolve(distRoot), build, errors);
    browser = await chromium.launch({headless: true, executablePath, env: await browserEnvironment(), args: ['--no-sandbox', '--disable-dev-shm-usage']});
    result.browser.version = browser.version();
    const home = await cold('desktop.home', endpoints.home);
    await action(home, 'desktop.theme-toggle', endpoints.theme, {role: 'button', name: themeName}, 'interaction');
    // NOTE: Reset only the user-operated theme in a separate owned setup action.
    await action(home, 'setup.theme-light', {...endpoints.theme, theme: 'light'}, {role: 'button', name: themeName}, 'interaction', result.setup);
    await action(home, 'desktop.blog-list', endpoints.blog, {role: 'link', name: 'Blog'});
    await action(home, 'desktop.blog-article', endpoints.article, {role: 'text', name: articleTitle});
    // NOTE: Portable return-to-list navigation, not an untrusted history.go timer.
    await action(home, 'desktop.blog-back', endpoints.blog, {role: 'link', name: 'Blog'});
    await action(home, 'setup.return-home', endpoints.home, {role: 'link', name: 'Home'}, 'spa-warm', result.setup);
    await action(home, 'desktop.discography', endpoints.discography, {role: 'link', name: 'Discography'});
    // NOTE: The release heading is the visible text of the native navigation link.
    await action(home, 'desktop.discography-detail', endpoints.detail, {role: 'heading', name: releaseTitle});
    await close(home);
    const article = await cold('desktop.article-cold', endpoints.article); await close(article);
    const detail = await cold('desktop.detail-cold', endpoints.detail); await close(detail);
    const menu = await cold('setup.mobile-home', {path: '/', targets: [heading('ThinaticSystem'), link('もっと詳しく')]}, mobile, result.setup);
    await action(menu, 'mobile.menu-open', endpoints.menuOpen, {role: 'button', name: 'メニューを開きます'}, 'interaction');
    await action(menu, 'mobile.menu-close', endpoints.menuClosed, {role: 'button', name: 'メニューを閉じます'}, 'interaction');
    await close(menu);
    // NOTE: Home pixels come from a separate diagnostic context, never from the
    // context whose subsequent warm journeys are measured.
    const homePixels = await cold('setup.home-pixels', endpoints.home, desktop, result.setup);
    await close(homePixels);
    if (captureBuildIdentity(resolve(distRoot)).sha256 !== result.buildSha256) errors.push('Build changed during collection');
  } catch (error) {
    errors.push(`Collection: ${error.stack ?? String(error)}`);
    // NOTE: Post-failure diagnostics do not create or repair an endpoint.
    for (const [index, owned] of [...contexts].entries()) if (owned.page) {
      try {
        await owned.page.screenshot({path: join(output, `failed-context-${index}.png`), fullPage: true});
        writeFileSync(join(output, `failed-context-${index}.json`), JSON.stringify(await owned.page.evaluate(() => ({url: location.pathname, text: document.body.innerText, results: window.__performanceRecorder?.results})), null, 2), {flag:'wx'});
      } catch (diagnosticError) {errors.push(`Failure diagnostic: ${String(diagnosticError)}`);}
    }
  }
  finally {
    let cleaned = true;
    for (const owned of contexts) {
      try {
        // NOTE: Preserve outstanding resources even when endpoint collection failed.
        const partialResources = await owned.requests.finish(Number.POSITIVE_INFINITY);
        result.setup.push({id: 'partial-failure', resources: partialResources});
        await owned.requests.close();
      } catch (error) {cleaned = false; errors.push(`Context cleanup: ${String(error)}`);}
    }
    try {await browser?.close();} catch (error) {cleaned = false; errors.push(`Browser cleanup: ${String(error)}`);}
    try {await server?.close();} catch (error) {cleaned = false; errors.push(`Server cleanup: ${String(error)}`);}
    result.cleanup = cleaned;
    writeFileSync(join(output, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n', {flag: 'wx'});
    writeFileSync(join(output, 'observation.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {values} = parseArgs({options: {dist: {type: 'string'}, output: {type: 'string'}, side: {type: 'string'}, ordinal: {type: 'string'}}});
  collectPerformance({distRoot: values.dist, outputDirectory: values.output, side: values.side, attemptOrdinal: Number(values.ordinal)})
    .then(result => {process.stdout.write(JSON.stringify(result) + '\n'); if (result.errors.length || !result.cleanup) process.exitCode = 1;})
    .catch(error => {process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1;});
}
