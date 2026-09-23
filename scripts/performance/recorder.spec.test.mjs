import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestLedger} from './recorder.mjs';
import {fixtureFor, release, article} from './fixtures.mjs';

test('Given a new ledger, when a request begins before its terminal callback, then the request remains owned with unknown bytes', () => {
  const ledger = createRequestLedger('context-1');
  ledger.begin('parent', {url: 'https://example.test/a.js', category: 'code', owner: 'journey', startInMs: 10});
  assert.equal(ledger.pending('journey'), 1);
  assert.deepEqual(ledger.snapshot('journey', 15)[0], {id: 'context-1:1', url: 'https://example.test/a.js', category: 'code', terminal: 'unknown', decodedBodySizeInBytes: null, scope: 'action'});
});

test('Given a parent request and a child request, when the parent finishes during drain, then the child stays in the tail scope', () => {
  const ledger = createRequestLedger('context-1');
  ledger.begin('parent', {url: '/parent', category: 'api', owner: 'journey', startInMs: 1});
  ledger.begin('child', {url: '/child', category: 'api', owner: 'journey', startInMs: 20});
  ledger.terminal('parent', 'finished', 12);
  assert.equal(ledger.pending('journey'), 1);
  ledger.terminal('child', 'finished', 8);
  assert.deepEqual(ledger.snapshot('journey', 10).map(record => [record.scope, record.terminal, record.decodedBodySizeInBytes]), [['action', 'finished', 12], ['tail', 'finished', 8]]);
});

test('Given an image request with unknown bytes, when it fails, then failure and invalid terminal transitions remain explicit', () => {
  const ledger = createRequestLedger('x');
  ledger.begin(1, {url: '/x', category: 'image', owner: 'a', startInMs: 1});
  ledger.terminal(1, 'failed');
  assert.equal(ledger.snapshot('a', 1)[0].decodedBodySizeInBytes, null);
  assert.equal(ledger.snapshot('a', 1)[0].terminal, 'failed');
  assert.throws(() => ledger.terminal(1, 'finished', 0), /Duplicate/);
  assert.throws(() => ledger.terminal(2, 'finished', 0), /without request begin/);
  assert.throws(() => ledger.begin(1, {}), /Duplicate/);
});

test('Given requests recorded across owners, when the page clock resets, then IDs and preceding owner records remain addressable', () => {
  const ledger = createRequestLedger('context-3');
  ledger.begin(1, {url: '/one', category: 'document', owner: 'cold', startInMs: 100});
  ledger.terminal(1, 'finished', 25);
  ledger.begin(2, {url: '/two', category: 'document', owner: 'next', startInMs: 200});
  ledger.terminal(2, 'finished', 30);
  assert.equal(ledger.snapshot('cold', 110)[0].id, 'context-3:1');
  assert.equal(ledger.snapshot('next', 210)[0].id, 'context-3:2');
});

test('Given the CMS fixture table, when an unknown host path query or method is requested, then no fixture is returned', () => {
  assert.ok(fixtureFor('https://cms.thinaticsystem.com/blogs?_sort=published_at:desc&_limit=6&_start=0'));
  for (const url of ['https://cms.thinaticsystem.com/blogs/2', 'https://cms.thinaticsystem.com/blogs?anything=1', 'https://cms.thinaticsystem.com/uploads/unknown.png', 'http://cms.thinaticsystem.com/blogs', 'https://player.example.test/embed']) assert.equal(fixtureFor(url), null);
  assert.equal(fixtureFor('https://cms.thinaticsystem.com/blogs', 'POST'), null);
});

test('Given the detail and article fixtures, when CMS arrays and rich markdown are consumed, then all overrides remain visible', () => {
  assert.deepEqual(JSON.parse(fixtureFor('https://cms.thinaticsystem.com/discographies/1').body), release);
  assert.equal(release.detailComponent[0].body, 'Fixture composer');
  assert.equal(release.artwork.formats.small.url, '/uploads/performance-artwork.svg');
  assert.equal(release.demoComponent.length, 0);
  assert.match(article.body, /\*\*Formatted fixture\*\*/);
  assert.match(article.body, /\[Reader reference\]\(https:/);
  assert.match(article.body, /!\[\*\*Fixture illustration\*\*\]/);
});
