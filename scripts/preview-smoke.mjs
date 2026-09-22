import assert from 'node:assert/strict';
const base = process.argv[2];
if (!base) throw new Error('usage: node scripts/preview-smoke.mjs <deployment-url>');
const origin = new URL(base.endsWith('/') ? base : `${base}/`);
const checks = [
  {name: 'root', path: '/', type: 'text/html'},
  {name: 'about deep link', path: '/about', type: 'text/html'},
  {name: 'blog deep link', path: '/blog', type: 'text/html'},
  {name: 'discography deep link', path: '/discography', type: 'text/html'},
  {name: 'site asset', path: '/assets/site_logo.svg', type: 'image/svg+xml'},
  {name: 'CMS API', url: 'https://cms.thinaticsystem.com/blogs?_limit=1', type: null},
];
for (const check of checks) {
  const url = check.url ?? new URL(check.path, origin).href;
  const response = await fetch(url, {headers: {accept: '*/*'}});
  assert.ok(response.status >= 200 && response.status < 400, `${check.name}: HTTP ${response.status} (${url})`);
  if (check.type) assert.match(response.headers.get('content-type') ?? '', new RegExp(check.type.replace('/', '\\/')), `${check.name}: content type`);
  if (check.type === 'text/html') assert.match(await response.text(), /<app-root\b/i, `${check.name}: Angular shell`);
}
console.log(`preview smoke passed: ${checks.map(check => check.name).join(', ')}`);
