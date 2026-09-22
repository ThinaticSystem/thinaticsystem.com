import assert from 'node:assert/strict';
import test from 'node:test';
import {extractSameOriginAssets} from './preview-smoke-assets.mjs';

test('When the recorded scenario is exercised Then the contract demonstrates that asset extraction accepts either HTML attribute order and excludes external assets', () => {
  const origin = new URL('https://candidate.pages.dev/');
  const html = '<link href="/styles.css" rel="stylesheet"><script src="/main.js" type="module"></script><script type="module" src="https://cdn.example.test/vendor.js"></script><link rel="stylesheet" href="https://cdn.example.test/vendor.css">';
  const assets = extractSameOriginAssets(html, origin);
  assert.deepEqual(assets.moduleScripts.map(url => url.href), ['https://candidate.pages.dev/main.js']);
  assert.deepEqual(assets.stylesheets.map(url => url.href), ['https://candidate.pages.dev/styles.css']);
});

test('When the recorded scenario is exercised Then the contract demonstrates that asset extraction requires the relevant module and stylesheet markers', () => {
  const assets = extractSameOriginAssets('<script src="/classic.js"></script><link href="/icon.svg" rel="icon">', new URL('https://candidate.pages.dev/'));
  assert.deepEqual(assets, {moduleScripts: [], stylesheets: []});
});
