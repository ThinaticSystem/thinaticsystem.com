import {createRequire} from 'node:module';

const require = createRequire('/tmp/thinaticsystem-baseline-browser/package.json');
const {chromium} = require('playwright');
const browserExecutable = '/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome';
const baseUrl = 'http://127.0.0.1:4300';
const onePixelGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const blogs = [
  {
    id: 1,
    title: 'Synthetic article one',
    body: '# Synthetic article\n\nFixture content for a deterministic browser baseline.',
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    blogTags: [{id: 1, tag: 'fixture'}],
    eyecatch: null,
  },
];

function jsonResponse(body) {
  return {status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: {'access-control-allow-origin': '*'}};
}

function fixtureFor(url) {
  const parsed = new URL(url);
  if (parsed.hostname === 'cms.thinaticsystem.com') {
    if (parsed.pathname === '/notifications') return jsonResponse([]);
    if (parsed.pathname === '/blogs/count') return jsonResponse(blogs.length);
    if (parsed.pathname === '/blogs/1') return jsonResponse(blogs[0]);
    if (parsed.pathname === '/blogs') return jsonResponse(blogs);
    if (parsed.pathname.startsWith('/uploads/')) return {status: 200, contentType: 'image/gif', body: onePixelGif, headers: {'access-control-allow-origin': '*'}};
  }
  if (parsed.hostname === 'thinaticsystem.com' && parsed.pathname === '/workers/patrons') return jsonResponse([]);
  return null;
}

const result = {steps: [], consoleErrors: [], pageErrors: [], failedRequests: [], blockedExternalRequests: []};
const browser = await chromium.launch({headless: true, executablePath: browserExecutable, args: ['--no-sandbox', '--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    const fixture = fixtureFor(requestUrl);
    if (fixture) return route.fulfill(fixture);
    if (requestUrl.startsWith(`${baseUrl}/`)) return route.continue();
    result.blockedExternalRequests.push(requestUrl);
    return route.abort('blockedbyclient');
  });
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push({url: request.url(), failure: request.failure()?.errorText ?? 'unknown'}));

  await page.goto(`${baseUrl}/`, {waitUntil: 'domcontentloaded'});
  await page.getByText('ThinaticSystem', {exact: true}).waitFor({state: 'visible'});
  await page.waitForTimeout(700);
  result.steps.push({name: 'home', url: page.url()});

  await page.getByRole('link', {name: 'Blog', exact: true}).first().click();
  await page.getByRole('heading', {name: 'Blog', exact: true}).waitFor({state: 'visible'});
  await page.getByText('Synthetic article one', {exact: true}).waitFor({state: 'visible'});
  result.steps.push({name: 'blog-list', url: page.url()});

  await page.getByText('Synthetic article one', {exact: true}).click();
  await page.getByRole('heading', {name: 'Synthetic article one', exact: true}).waitFor({state: 'visible'});
  await page.getByText('Fixture content for a deterministic browser baseline.', {exact: true}).waitFor({state: 'visible'});
  result.steps.push({name: 'blog-article-readable', url: page.url(), articleText: await page.getByText('Fixture content for a deterministic browser baseline.', {exact: true}).textContent()});
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.consoleErrors.length || result.pageErrors.length || result.failedRequests.length || result.blockedExternalRequests.length) process.exitCode = 1;
