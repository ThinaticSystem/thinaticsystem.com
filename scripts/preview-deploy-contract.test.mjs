import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = () => readFile('.github/workflows/ci.yml', 'utf8');
const requireLine = (text, pattern, description) => assert.match(text, pattern, description);

test('preview deploy is gated by exact candidate artifact and readback smoke', async () => {
  const text = await source();
  const preview = text.slice(text.indexOf('  preview:'));
  requireLine(text, /preview:\n    name: deploy verified artifact to Pages preview\n    needs: verify/m, 'preview needs verification');
  requireLine(text, /github\.event_name == 'push'/, 'push-only deployment');
  requireLine(text, /github\.ref == 'refs\/heads\/chore\/modernization-renovate'/, 'candidate branch only');
  requireLine(text, /github\.repository == 'ThinaticSystem\/thinaticsystem\.com'/, 'repository boundary');
  requireLine(text, /name: thinaticsystem-verification-\$\{\{ github\.sha \}\}/, 'exact SHA artifact');
  requireLine(text, /p\.sha !== process\.env\.EXPECTED_SHA/, 'provenance SHA check');
  requireLine(text, /p\.repository !== process\.env\.EXPECTED_REPOSITORY/, 'provenance repository check');
  requireLine(text, /statSync\('dist\/app\/browser\/index\.html'\)/, 'built output witness');
  requireLine(text, /command: pages deploy dist\/app\/browser --project-name=thinaticsystem-com --branch=chore-modernization-renovate/, 'explicit non-production Pages target');
  requireLine(text, /id: deploy[\s\S]*deployment-url/, 'deployment URL readback');
  requireLine(text, /run: node scripts\/preview-smoke\.mjs/, 'post-deploy smoke');
  requireLine(text, /wranglerVersion: 4\.136\.1/, 'verified Wrangler version');
  requireLine(text, /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/, 'immutable checkout action');
  requireLine(text, /actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38/, 'immutable setup-node action');
  requireLine(text, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/, 'immutable upload action');
  requireLine(text, /actions\/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0/, 'immutable download action');
  requireLine(text, /cloudflare\/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0/, 'immutable Wrangler action');
  assert.doesNotMatch(preview, /wrangler deploy(?!.*pages)/, 'Pages deploy only');
  assert.doesNotMatch(preview, /master|production|workers\.dev/i, 'no production target');
  const smoke = await readFile('scripts/preview-smoke.mjs', 'utf8');
  for (const path of ['/', '/about', '/blog', '/discography', '/assets/site_logo.svg', 'cms.thinaticsystem.com/blogs?_limit=1']) assert.match(smoke, new RegExp(path.replace(/[.?/]/g, '\\$&')), `smoke includes ${path}`);
});
