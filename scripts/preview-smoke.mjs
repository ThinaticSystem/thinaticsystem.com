import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {extractSameOriginAssets} from './preview-smoke-assets.mjs';
import {assertArticleDetailMatches, parseArticleList} from './preview-smoke-article.mjs';
import {hasAngularShell} from './preview-smoke-shell.mjs';

const base = process.argv[2];
if (!base) throw new Error('usage: node scripts/preview-smoke.mjs <deployment-url>');
const origin = new URL(base.endsWith('/') ? base : `${base}/`);
const checks = [
  {name: 'root', path: '/', type: 'text/html'},
  {name: 'about deep link', path: '/about', type: 'text/html'},
  {name: 'blog deep link', path: '/blog', type: 'text/html'},
  {name: 'discography deep link', path: '/discography', type: 'text/html'},
  {name: 'discography detail deep link', path: '/discography/1', type: 'text/html'},
  {name: 'site asset', path: '/assets/site_logo.svg', type: 'image/svg+xml'},
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
  if (check.type) assert.equal((response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase(), check.type.toLowerCase(), `${check.name}: content type`);
  if (check.type === 'text/html') assert.ok(hasAngularShell(await response.text()), `${check.name}: Angular shell`);
}
const articleListResponse = await fetch('https://cms.thinaticsystem.com/blogs?_limit=20', {headers: {accept: 'application/json'}});
assert.ok(articleListResponse.status >= 200 && articleListResponse.status < 300, `CMS article list: HTTP ${articleListResponse.status}`);
let articleList;
try { articleList = await articleListResponse.json(); } catch (error) { throw new Error('CMS article list is not valid JSON', {cause: error}); }
const [article] = parseArticleList(articleList);
const articleDetailResponse = await fetch(`https://cms.thinaticsystem.com/blogs/${article.id}`, {headers: {accept: 'application/json'}});
assert.ok(articleDetailResponse.status >= 200 && articleDetailResponse.status < 300, `CMS article ${article.id}: HTTP ${articleDetailResponse.status}`);
let articleDetail;
try { articleDetail = await articleDetailResponse.json(); } catch (error) { throw new Error(`CMS article ${article.id} detail is not valid JSON`, {cause: error}); }
assertArticleDetailMatches(article, articleDetail);

const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
const context = await browser.newContext();
const consoleErrors = []; const pageErrors = []; const requestFailures = []; const assetResponses = new Map(); const scriptResponses = new Map();
context.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
context.on('pageerror', error => pageErrors.push(String(error)));
context.on('requestfailed', request => requestFailures.push({url: request.url(), failure: request.failure()?.errorText ?? 'unknown'}));
context.on('response', response => {
  if (new URL(response.url()).origin === origin.origin && response.request().resourceType() === 'script') {
    const observations = scriptResponses.get(response.url()) ?? [];
    observations.push({status: response.status(), contentType: response.headers()['content-type'] ?? ''});
    scriptResponses.set(response.url(), observations);
  }
  const matching = assetExpectations.find(asset => asset.url.href === response.url());
  if (matching) {
    const observations = assetResponses.get(response.url()) ?? [];
    observations.push({status: response.status(), contentType: response.headers()['content-type'] ?? ''});
    assetResponses.set(response.url(), observations);
  }
});
const page = await context.newPage();
async function open(path, heading) {
  const response = await page.goto(new URL(path, origin).href, {waitUntil: 'networkidle'});
  assert.ok(response && response.ok(), `${path}: navigation failed`);
  if (heading) await assert.doesNotReject(() => page.getByRole('heading', {name: heading}).waitFor({state: 'visible'}));
  else await assert.doesNotReject(() => page.getByRole('heading').first().waitFor({state: 'visible'}));
}
try {
  await open('/', 'ThinaticSystem');
  await page.getByRole('link', {name: /楽曲一覧/}).click();
  await page.getByRole('heading', {name: /Discography|ディスコグラフィ/}).waitFor({state: 'visible'});
  const releaseLink = page.getByRole('link').filter({has: page.getByRole('heading', {level: 2}).first()}).first();
  const releasePath = await releaseLink.getAttribute('href');
  assert.match(releasePath ?? '', /^\/discography\/\d+$/, 'discography listing has no real release link');
  await releaseLink.click();
  await page.getByRole('heading').first().waitFor({state: 'visible'});
  await open(releasePath, '');
  const articlePath = `/blog/article/${article.id}`;
  await open(articlePath, article.title);
  assert.equal(new URL(page.url()).pathname, articlePath, 'article navigation changed the selected article URL');
  const visibleArticle = (await page.locator('body').innerText()).replace(/\s+/g, '');
  const expectedBodyExcerpt = article.body.replace(/\s+/g, '').slice(0, 24);
  assert.ok(expectedBodyExcerpt.length >= 8 && visibleArticle.includes(expectedBodyExcerpt), 'selected CMS article body is not visible');
} finally {
  try {
    await context.close();
  } finally {
    await browser.close();
  }
}
for (const [url, observations] of scriptResponses) {
  const successfulIndex = observations.findIndex(response => response.status >= 200 && response.status < 300);
  assert.ok(successfulIndex >= 0, `browser script asset had no successful response: ${url} (${observations.map(response => response.status).join('/')})`);
  assert.ok(observations.every((response, index) => response.status >= 200 && response.status < 300 || response.status === 304 && index > successfulIndex), `browser script asset had unexpected responses: ${observations.map(response => response.status).join('/')}: ${url}`);
  for (const response of observations.filter(response => response.status >= 200 && response.status < 300)) assert.match(response.contentType, /javascript|ecmascript/i, `browser script asset content type: ${url}`);
}
for (const asset of assetExpectations) {
  const observations = assetResponses.get(asset.url.href) ?? [];
  const successfulIndex = observations.findIndex(response => response.status >= 200 && response.status < 300);
  assert.ok(successfulIndex >= 0, `browser did not successfully request exact ${asset.type} asset: ${asset.url}`);
  assert.ok(observations.every((response, index) => response.status >= 200 && response.status < 300 || response.status === 304 && index > successfulIndex), `browser ${asset.type} asset had unexpected responses: ${observations.map(response => response.status).join("/")}: ${asset.url}`);
  const witness = observations[successfulIndex];
  assert.match(witness.contentType, asset.type === 'javascript' ? /javascript|ecmascript/i : /text\/css/i, `browser ${asset.type} content type: ${asset.url}`);
}
assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
assert.deepEqual(requestFailures, [], `request failures: ${JSON.stringify(requestFailures)}`);
console.log(`preview browser witness passed: root, article deep link, discography detail, exact module/css assets, console/page/request clean`);
