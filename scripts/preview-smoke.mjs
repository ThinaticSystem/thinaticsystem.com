import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {extractSameOriginAssets} from './preview-smoke-assets.mjs';

const base = process.argv[2];
if (!base) throw new Error('usage: node scripts/preview-smoke.mjs <deployment-url>');
const origin = new URL(base.endsWith('/') ? base : `${base}/`);
const checks = [
  {name: 'root', path: '/', type: 'text/html'},
  {name: 'about deep link', path: '/about', type: 'text/html'},
  {name: 'blog deep link', path: '/blog', type: 'text/html'},
  {name: 'discography deep link', path: '/discography', type: 'text/html'},
  {name: 'article deep link', path: '/blog/article/1', type: 'text/html'},
  {name: 'discography detail deep link', path: '/discography/1', type: 'text/html'},
  {name: 'site asset', path: '/assets/site_logo.svg', type: 'image/svg+xml'},
  {name: 'CMS API', url: 'https://cms.thinaticsystem.com/blogs?_limit=1', type: null},
];
const rootResponse = await fetch(new URL('/', origin), {headers: {accept: 'text/html'}});
assert.ok(rootResponse.status >= 200 && rootResponse.status < 300, `root: HTTP ${rootResponse.status}`);
const rootHtml = await rootResponse.text();
const {moduleScripts: moduleScriptUrls, stylesheets: stylesheetUrls} = extractSameOriginAssets(rootHtml, origin);
const moduleAssets = moduleScriptUrls;
const stylesheetAssets = stylesheetUrls;
assert.ok(moduleAssets.length >= 1, 'root HTML has no same-origin module script');
assert.ok(stylesheetAssets.length >= 1, 'root HTML has no same-origin stylesheet');
const assetExpectations = [
  ...moduleAssets.map(url => ({url, type: 'javascript'})),
  ...stylesheetAssets.map(url => ({url, type: 'css'})),
];
for (const asset of assetExpectations) {
  const response = await fetch(asset.url, {headers: {accept: '*/*'}});
  assert.ok(response.status >= 200 && response.status < 300, `${asset.type} asset HTTP ${response.status}: ${asset.url}`);
  const contentType = response.headers.get('content-type') ?? '';
  assert.match(contentType, asset.type === 'javascript' ? /javascript|ecmascript/i : /text\/css/i, `${asset.type} asset content type: ${asset.url}`);
}
for (const check of checks.slice(1)) {
  const url = check.url ?? new URL(check.path, origin).href;
  const response = await fetch(url, {headers: {accept: '*/*'}});
  assert.ok(response.status >= 200 && response.status < 400, `${check.name}: HTTP ${response.status} (${url})`);
  if (check.type) assert.match(response.headers.get('content-type') ?? '', new RegExp(check.type.replace('/', '\/')), `${check.name}: content type`);
  if (check.type === 'text/html') assert.match(await response.text(), /<app-root/i, `${check.name}: Angular shell`);
}
const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
const context = await browser.newContext();
const consoleErrors = []; const pageErrors = []; const requestFailures = []; const assetResponses = new Map();
context.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
context.on('pageerror', error => pageErrors.push(String(error)));
context.on('requestfailed', request => requestFailures.push({url: request.url(), failure: request.failure()?.errorText ?? 'unknown'}));
context.on('response', response => {
  const matching = assetExpectations.find(asset => asset.url.href === response.url());
  if (matching) assetResponses.set(response.url(), {status: response.status(), contentType: response.headers()['content-type'] ?? ''});
});
const page = await context.newPage();
async function open(path, heading) {
  const response = await page.goto(new URL(path, origin).href, {waitUntil: 'networkidle'});
  assert.ok(response && response.ok(), `${path}: navigation failed`);
  if (heading) await assert.doesNotReject(() => page.getByRole('heading', {name: heading}).waitFor({state: 'visible'}));
  else await assert.doesNotReject(() => page.getByRole('heading').first().waitFor({state: 'visible'}));
}
await open('/', 'ThinaticSystem');
await page.getByRole('link', {name: /楽曲一覧/}).click();
await page.getByRole('heading', {name: /Discography|ディスコグラフィ/}).waitFor({state: 'visible'});
await page.getByRole('link', {name: /Synthetic release|詳細|detail/i}).first().click().catch(() => page.goto(new URL('/discography/1', origin).href, {waitUntil: 'networkidle'}));
await page.getByRole('heading').first().waitFor({state: 'visible'});
await open('/blog/article/1', '');
assert.ok((await page.locator('body').innerText()).trim().length > 0, 'article content is empty');
await page.goBack({waitUntil: 'networkidle'}).catch(() => {});
await context.close();
await browser.close();
for (const asset of assetExpectations) {
  const witness = assetResponses.get(asset.url.href);
  assert.ok(witness, `browser did not request exact ${asset.type} asset: ${asset.url}`);
  assert.ok(witness.status >= 200 && witness.status < 300, `browser ${asset.type} asset HTTP ${witness.status}: ${asset.url}`);
  assert.match(witness.contentType, asset.type === 'javascript' ? /javascript|ecmascript/i : /text\/css/i, `browser ${asset.type} content type: ${asset.url}`);
}
assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
assert.deepEqual(requestFailures, [], `request failures: ${JSON.stringify(requestFailures)}`);
console.log(`preview browser witness passed: root, article deep link, discography detail, exact module/css assets, console/page/request clean`);
