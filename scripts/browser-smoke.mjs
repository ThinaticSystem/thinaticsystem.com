import {createServer} from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const distRoot = process.env.DIST_ROOT ?? 'dist/app/browser';
const baseUrl = process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:4174';
const evidenceRoot = process.env.EVIDENCE_DIR ?? '.artifacts';
const outputPath = process.env.EVIDENCE_OUTPUT ?? null;
const browserExecutablePath = process.env.BROWSER_EXECUTABLE_PATH ?? chromium.executablePath();
const repeatCount = Number(process.env.BROWSER_REPEATS ?? 3);
const onePixelGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const blogs = [
  {id: 1, title: 'Synthetic article one', body: '# Synthetic article\n\nFixture content for a deterministic browser baseline.', published_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', blogTags: [{id: 1, tag: 'fixture'}], eyecatch: null},
  {id: 2, title: 'Synthetic article two', body: 'Second fixture article.', published_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', blogTags: [], eyecatch: null},
];
const discographies = [{id: 1, title: 'Synthetic release', release: '2024-01-03T00:00:00.000Z', detail: 'Fixture release', url: '/discography/1', demoComponent: [], detailComponent: [], buyComponent: [], dlComponent: [], artwork: {alternativeText: 'Synthetic artwork', url: '/uploads/synthetic.png', width: 1, height: 1, formats: {small: {url: '/uploads/synthetic.png'}}}}];

function jsonResponse(body) {
  return {status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: {'access-control-allow-origin': '*'}};
}

function fixtureFor(url) {
  const parsed = new URL(url);
  if (parsed.hostname === 'cms.thinaticsystem.com') {
    if (parsed.pathname === '/notifications') return jsonResponse([{title: 'Synthetic notice', url: '/', published_at: '2024-01-01T00:00:00.000Z'}]);
    if (parsed.pathname === '/blogs/count') return jsonResponse(blogs.length);
    if (parsed.pathname === '/blogs/1') return jsonResponse(blogs[0]);
    if (parsed.pathname === '/blogs/2') return jsonResponse(blogs[1]);
    if (parsed.pathname === '/blogs') return jsonResponse(blogs);
    if (parsed.pathname === '/discographies') return jsonResponse(discographies);
    if (parsed.pathname.startsWith('/uploads/')) return {status: 200, contentType: 'image/gif', body: onePixelGif, headers: {'access-control-allow-origin': '*'}};
  }
  if (parsed.hostname === 'thinaticsystem.com' && parsed.pathname === '/workers/patrons') return jsonResponse([{data: {id: 'fixture-1', type: 'patron', attributes: {full_name: 'Synthetic patron', patron_status: 'active_patron'}}}]);
  return null;
}

function contentType(filePath) {
  return ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon'})[extname(filePath)] ?? 'application/octet-stream';
}

function createStaticServer() {
  return createServer((request, response) => {
    let requestPath;
    try {
      requestPath = new URL(request.url ?? '/', baseUrl).pathname;
    } catch {
      response.writeHead(400, {'content-type': 'text/plain; charset=utf-8'});
      response.end('Bad request');
      return;
    }
    const relativePath = normalize(decodeURIComponent(requestPath)).replace(/^\/+/, '');
    const candidate = join(distRoot, relativePath);
    const safeCandidate = candidate === distRoot || candidate.startsWith(`${distRoot}/`) ? candidate : join(distRoot, 'index.html');
    const isAssetRequest = Boolean(extname(requestPath));
    const filePath = existsSync(safeCandidate) && statSync(safeCandidate).isFile() ? safeCandidate : isAssetRequest ? null : join(distRoot, 'index.html');
    if (!filePath) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
      response.end('Not found');
      return;
    }
    response.writeHead(200, {'content-type': contentType(filePath), 'cache-control': 'no-store'});
    createReadStream(filePath).pipe(response);
  });
}

async function waitForText(page, text) {
  await page.getByText(text, {exact: true}).first().waitFor({state: 'visible', timeout: 10_000});
}

async function waitForVisualReady(page) {
  await page.evaluate(async () => {
    const animations = document.getAnimations();
    const allFinished = Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    await Promise.race([allFinished, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
}

async function scanA11y(page, result, name) {
  const scan = await new AxeBuilder({page}).analyze();
  result.a11y.push({name, violations: scan.violations.map(({id, impact, description, helpUrl, nodes}) => ({id, impact, description, helpUrl, nodes: nodes.map(({target, html}) => ({target, html}))}))});
}

async function runRepeat(browser, server, repeat) {
  const result = {repeat, browser: {name: 'Chromium', executablePath: browserExecutablePath, version: browser.version()}, journeys: [], observations: [], a11y: [], consoleErrors: [], pageErrors: [], failedRequests: [], blockedExternalRequests: [], staticResourceSummary: null};
  const requestLog = [];
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const routeFixtures = async (route) => {
    const requestUrl = route.request().url();
    const fixture = fixtureFor(requestUrl);
    if (fixture) return route.fulfill(fixture);
    if (requestUrl.startsWith(`${baseUrl}/`)) return route.continue();
    result.blockedExternalRequests.push({url: requestUrl, method: route.request().method()});
    return route.abort('blockedbyclient');
  };
  await context.route('**/*', routeFixtures);
  const page = await context.newPage();
  page.on('request', (request) => requestLog.push({method: request.method(), url: request.url()}));
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push({text: message.text(), url: page.url()}); });
  page.on('pageerror', (error) => result.pageErrors.push({message: error.message, url: page.url()}));
  page.on('requestfailed', (request) => result.failedRequests.push({url: request.url(), failure: request.failure()?.errorText ?? 'unknown'}));
  const record = async (name, action, screenshotName = null) => {
    const startedAt = performance.now();
    const requestStart = requestLog.length;
    await action();
    await waitForVisualReady(page);
    const elapsedInMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const screenshotPath = screenshotName ? join(evidenceRoot, `browser-${screenshotName}-repeat-${repeat}.png`) : null;
    if (screenshotPath) await page.screenshot({path: screenshotPath, fullPage: true});
    result.journeys.push({name, url: page.url(), elapsedInMs, requestCount: requestLog.length - requestStart});
  };
  try {
    await record('desktop.home', async () => {
      await page.goto(`${baseUrl}/`, {waitUntil: 'domcontentloaded'});
      await waitForText(page, 'ThinaticSystem');
      await waitForText(page, 'Synthetic notice');
      await page.getByRole('main').waitFor({state: 'visible'});
      await scanA11y(page, result, 'desktop.home');
    }, 'home-desktop');
    await record('desktop.theme-toggle', async () => {
      const themeToggle = page.getByRole('button', {name: 'ライトモードとダークモードを切り替えます'});
      await themeToggle.focus();
      await themeToggle.press('Enter');
      result.observations.push({name: 'desktop.theme-toggle', keyboard: true, ariaPressed: await themeToggle.getAttribute('aria-pressed'), focused: await themeToggle.evaluate((element) => element === document.activeElement)});
      await scanA11y(page, result, 'desktop.theme-toggle');
    });
    await record('desktop.blog-list', async () => {
      await page.getByRole('link', {name: 'Blog', exact: true}).first().click();
      await page.getByRole('heading', {name: 'Blog', exact: true}).waitFor({state: 'visible'});
      await waitForText(page, 'Synthetic article one');
      await scanA11y(page, result, 'desktop.blog-list');
    }, 'blog-list');
    await record('desktop.blog-article', async () => {
      await page.getByText('Synthetic article one', {exact: true}).click();
      await page.getByRole('heading', {name: 'Synthetic article one', exact: true}).waitFor({state: 'visible'});
      await waitForText(page, 'Fixture content for a deterministic browser baseline.');
      await scanA11y(page, result, 'desktop.blog-article');
    }, 'blog-article');
    await record('desktop.blog-back', async () => {
      await page.goBack({waitUntil: 'domcontentloaded'});
      await page.getByRole('heading', {name: 'Blog', exact: true}).waitFor({state: 'visible'});
    });
    await record('desktop.discography', async () => {
      await page.getByRole('link', {name: 'Discography', exact: true}).first().click();
      await page.getByRole('heading', {name: 'Discography', exact: true}).waitFor({state: 'visible'});
      await waitForText(page, 'Synthetic release');
      await scanA11y(page, result, 'desktop.discography');
    }, 'discography');
  } finally {
    await context.close();
  }

  const mobileContext = await browser.newContext({viewport: {width: 375, height: 812}, reducedMotion: 'reduce'});
  const mobileRequestLog = [];
  await mobileContext.route('**/*', routeFixtures);
  const mobile = await mobileContext.newPage();
  mobile.on('request', (request) => mobileRequestLog.push({method: request.method(), url: request.url()}));
  mobile.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push({text: message.text(), url: mobile.url()}); });
  mobile.on('pageerror', (error) => result.pageErrors.push({message: error.message, url: mobile.url()}));
  mobile.on('requestfailed', (request) => result.failedRequests.push({url: request.url(), failure: request.failure()?.errorText ?? 'unknown'}));
  try {
    const startedAt = performance.now();
    await mobile.goto(`${baseUrl}/`, {waitUntil: 'domcontentloaded'});
    await waitForText(mobile, 'ThinaticSystem');
    const viewport = mobile.viewportSize();
    const reflow = await mobile.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth}));
    if (!viewport || viewport.width !== 375 || viewport.height !== 812) throw new Error(`Unexpected mobile viewport: ${JSON.stringify(viewport)}`);
    if (reflow.scrollWidth > reflow.clientWidth) throw new Error(`Horizontal overflow at mobile viewport: ${JSON.stringify(reflow)}`);
    await mobile.getByRole('button', {name: 'メニューを開きます'}).focus();
    await mobile.getByRole('button', {name: 'メニューを開きます'}).press('Enter');
    await mobile.getByRole('button', {name: 'メニューを閉じます'}).waitFor({state: 'visible'});
    await mobile.getByRole('button', {name: 'メニューを閉じます'}).press('Enter');
    await mobile.getByRole('button', {name: 'メニューを開きます'}).waitFor({state: 'visible'});
    await mobile.getByRole('button', {name: 'メニューを開きます'}).click();
    await mobile.getByRole('button', {name: 'メニューを閉じます'}).waitFor({state: 'visible'});
    await mobile.getByText('Blog', {exact: true}).last().click();
    await mobile.getByRole('heading', {name: 'Blog', exact: true}).waitFor({state: 'visible'});
    await waitForText(mobile, 'Synthetic article one');
    await scanA11y(mobile, result, 'mobile.menu-blog');
    await waitForVisualReady(mobile);
    result.observations.push({name: 'mobile.viewport-and-reflow', viewport, reflow, reducedMotion: 'reduce', keyboardMenu: true});
    result.journeys.push({name: 'mobile.menu-blog', url: mobile.url(), elapsedInMs: Math.round((performance.now() - startedAt) * 100) / 100, requestCount: mobileRequestLog.length});
    result.staticResourceSummary = await mobile.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.startsWith(location.origin)).reduce((summary, entry) => ({count: summary.count + 1, transferSizeInBytes: summary.transferSizeInBytes + Number(entry.transferSize ?? 0), decodedBodySizeInBytes: summary.decodedBodySizeInBytes + Number(entry.decodedBodySize ?? 0)}), {count: 0, transferSizeInBytes: 0, decodedBodySizeInBytes: 0}));
  } finally {
    await mobileContext.close();
  }
  return result;
}

function aggregateRuns(runs) {
  const names = [...new Set(runs.flatMap((run) => run.journeys.map((journey) => journey.name)))];
  const journeys = Object.fromEntries(names.map((name) => {
    const observations = runs.flatMap((run) => run.journeys.filter((journey) => journey.name === name));
    const elapsed = observations.map(({elapsedInMs}) => elapsedInMs).sort((left, right) => left - right);
    return [name, {runs: elapsed, medianInMs: elapsed[Math.floor(elapsed.length / 2)], requestCounts: observations.map(({requestCount}) => requestCount)}];
  }));
  return {journeys, staticResourceSummaries: runs.map(({staticResourceSummary}) => staticResourceSummary)};
}

async function main() {
  if (!existsSync(join(distRoot, 'index.html'))) throw new Error(`Build artifact missing: ${join(distRoot, 'index.html')}`);
  const {mkdirSync, writeFileSync} = await import('node:fs');
  mkdirSync(evidenceRoot, {recursive: true});
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(new URL(baseUrl).port, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, executablePath: browserExecutablePath, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  try {
    const runs = [];
    for (let repeat = 1; repeat <= repeatCount; repeat += 1) runs.push(await runRepeat(browser, server, repeat));
    const result = {schema: 'thinaticsystem-modernization/browser-smoke/v2', browser: runs[0].browser, repeatCount, runs, aggregate: aggregateRuns(runs), manualGates: ['visual inspection', 'representative screen-reader operation']};
    if (outputPath) {
      writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const violations = runs.flatMap(({a11y}) => a11y.flatMap(({violations: items}) => items));
    if (runs.some((run) => run.consoleErrors.length || run.pageErrors.length || run.failedRequests.length || run.blockedExternalRequests.length) || violations.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
