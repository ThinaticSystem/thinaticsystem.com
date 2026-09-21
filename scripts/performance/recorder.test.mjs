import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestLedger} from './recorder.mjs';
import {fixtureFor, release, article} from './fixtures.mjs';

test('begin owns in-flight requests before a terminal callback exists', () => {
  const ledger = createRequestLedger('context-1');
  ledger.begin('parent', {url: 'https://example.test/a.js', category: 'code', owner: 'journey', startInMs: 10});
  assert.equal(ledger.pending('journey'), 1);
  assert.deepEqual(ledger.snapshot('journey', 15)[0], {id: 'context-1:1', url: 'https://example.test/a.js', category: 'code', terminal: 'unknown', decodedBodySizeInBytes: null, scope: 'action'});
});

test('child begun during drain stays owned and has explicit tail scope', () => {
  const ledger = createRequestLedger('context-1');
  ledger.begin('parent', {url: '/parent', category: 'api', owner: 'journey', startInMs: 1});
  ledger.begin('child', {url: '/child', category: 'api', owner: 'journey', startInMs: 20});
  ledger.terminal('parent', 'finished', 12);
  assert.equal(ledger.pending('journey'), 1);
  ledger.terminal('child', 'finished', 8);
  assert.deepEqual(ledger.snapshot('journey', 10).map(record => [record.scope, record.terminal, record.decodedBodySizeInBytes]), [['action', 'finished', 12], ['tail', 'finished', 8]]);
});

test('unknown bytes are null, failures remain failures, illegal terminals reject', () => {
  const ledger = createRequestLedger('x');
  ledger.begin(1, {url: '/x', category: 'image', owner: 'a', startInMs: 1});
  ledger.terminal(1, 'failed');
  assert.equal(ledger.snapshot('a', 1)[0].decodedBodySizeInBytes, null);
  assert.equal(ledger.snapshot('a', 1)[0].terminal, 'failed');
  assert.throws(() => ledger.terminal(1, 'finished', 0), /Duplicate/);
  assert.throws(() => ledger.terminal(2, 'finished', 0), /without request begin/);
  assert.throws(() => ledger.begin(1, {}), /Duplicate/);
});

test('page clock reset cannot erase request IDs or preceding owner records', () => {
  const ledger = createRequestLedger('context-3');
  ledger.begin(1, {url: '/one', category: 'document', owner: 'cold', startInMs: 100});
  ledger.terminal(1, 'finished', 25);
  ledger.begin(2, {url: '/two', category: 'document', owner: 'next', startInMs: 200});
  ledger.terminal(2, 'finished', 30);
  assert.equal(ledger.snapshot('cold', 110)[0].id, 'context-3:1');
  assert.equal(ledger.snapshot('next', 210)[0].id, 'context-3:2');
});

test('CMS fixtures reject unknown host, path, query and method', () => {
  assert.ok(fixtureFor('https://cms.thinaticsystem.com/blogs?_sort=published_at:desc&_limit=6&_start=0'));
  for (const url of ['https://cms.thinaticsystem.com/blogs/2', 'https://cms.thinaticsystem.com/blogs?anything=1', 'https://cms.thinaticsystem.com/uploads/unknown.png', 'http://cms.thinaticsystem.com/blogs', 'https://player.example.test/embed']) assert.equal(fixtureFor(url), null);
  assert.equal(fixtureFor('https://cms.thinaticsystem.com/blogs', 'POST'), null);
});

test('detail fixture matches actual CMS arrays and rich markdown exercises overrides', () => {
  assert.deepEqual(JSON.parse(fixtureFor('https://cms.thinaticsystem.com/discographies/1').body), release);
  assert.equal(release.detailComponent[0].body, 'Fixture composer');
  assert.equal(release.artwork.formats.small.url, '/uploads/performance-artwork.svg');
  assert.equal(release.demoComponent.length, 0);
  assert.match(article.body, /\*\*Formatted fixture\*\*/);
  assert.match(article.body, /\[Reader reference\]\(https:/);
  assert.match(article.body, /!\[\*\*Fixture illustration\*\*\]/);
});
