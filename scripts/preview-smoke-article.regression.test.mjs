import assert from 'node:assert/strict';
import test from 'node:test';
import {assertArticleDetailMatches, parseArticleList} from './preview-smoke-article.mjs';

test('Given the live CMS list has real entries when choosing a healthy article then it uses the exact ID and content', () => {
  const article = parseArticleList([{id: 32, title: 'Real article', body: 'Actual CMS body'}])[0];
  assert.deepEqual(article, {id: 32, title: 'Real article', body: 'Actual CMS body'});
  assert.doesNotThrow(() => assertArticleDetailMatches(article, {...article}));
});

test('Given the CMS list is empty or malformed when choosing a healthy article then smoke fails explicitly', () => {
  assert.throws(() => parseArticleList([]), /non-empty JSON array/);
  assert.throws(() => parseArticleList({id: 32}), /non-empty JSON array/);
  assert.throws(() => parseArticleList([{id: 1, title: 'No body'}]), /invalid article/);
});

test('Given the chosen list entry differs from the CMS detail when verifying it then smoke rejects the mismatch', () => {
  const article = parseArticleList([{id: 32, title: 'Real article', body: 'Actual CMS body'}])[0];
  assert.throws(() => assertArticleDetailMatches(article, {...article, id: 1}), /does not match/);
  assert.throws(() => assertArticleDetailMatches(article, {...article, title: 'Different'}), /does not match/);
});
