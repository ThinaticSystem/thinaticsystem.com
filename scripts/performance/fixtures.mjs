import {createHash} from 'node:crypto';

const date = '2024-01-01T00:00:00.000Z';
export const articleTitle = 'Synthetic article one';
export const releaseTitle = 'Synthetic release';
export const articleBodyText = 'Fixture content for a deterministic reader journey.';
export const releaseBodyText = 'Fixture release description.';
export const article = {
  id: 1, title: articleTitle,
  body: `${articleBodyText}\n\n**Formatted fixture** and [Reader reference](https://example.invalid/reader).\n\n![**Fixture illustration**](/uploads/performance-reader.svg)`,
  published_at: date, created_at: date, updated_at: date,
  blogTags: [{id: 1, tag: 'fixture'}], eyecatch: null,
};
const format = {ext: '.svg', url: '/uploads/performance-artwork.svg', hash: 'performance-artwork', mime: 'image/svg+xml', name: 'performance-artwork.svg', path: null, size: 1, width: 96, height: 96};
export const release = {
  id: 1, title: releaseTitle, release: date, detail: releaseBodyText,
  url: '/discography/1', demoComponent: [],
  detailComponent: [{title: 'Composer', body: 'Fixture composer', url: ''}],
  buyComponent: [], dlComponent: [],
  artwork: {alternativeText: 'Synthetic artwork', url: format.url, width: 96, height: 96,
    formats: {large: format, medium: format, small: format, thumbnail: format}},
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#82b38e"/><circle cx="48" cy="48" r="24" fill="#deeDE2"/></svg>';
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const json = body => ({status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: {'access-control-allow-origin': '*'}});
const image = body => ({status: 200, contentType: 'image/svg+xml', body, headers: {'access-control-allow-origin': '*'}});
const fixtures = new Map([
  ['https://cms.thinaticsystem.com/notifications', json([{title: 'Synthetic notice', url: '/', published_at: date}])],
  ['https://cms.thinaticsystem.com/blogs/count', json(1)],
  ['https://cms.thinaticsystem.com/blogs/1', json(article)],
  ['https://cms.thinaticsystem.com/blogs', json([article])],
  ['https://cms.thinaticsystem.com/blogs?_limit=6&_sort=published_at%3Adesc&_start=0', json([article])],
  ['https://cms.thinaticsystem.com/discographies', json([release])],
  ['https://cms.thinaticsystem.com/discographies/1', json(release)],
  ['https://thinaticsystem.com/workers/patrons', json([])],
  ['https://cms.thinaticsystem.com/uploads/performance-reader.svg', image(svg)],
  ['https://cms.thinaticsystem.com/uploads/performance-artwork.svg', image(svg)],
  ['https://cms.thinaticsystem.com/uploads/thinatic_icon_ceb0aa7998.png', image(svg)],
  ['https://cms.thinaticsystem.com/uploads/loading_2c53045083.gif', {status: 200, contentType: 'image/gif', body: gif, headers: {'access-control-allow-origin': '*'}}],
  ['https://cms.thinaticsystem.com/uploads/noimage_f16114bd25.png', image(svg)],
  ['https://cms.thinaticsystem.com/uploads/small_noimage_f16114bd25.png', image(svg)],
]);

/** Exact origin/path/query/method fixtures. Unknown traffic is never a generic successful API/player response. */
export function fixtureFor(url, method = 'GET') {
  if (method !== 'GET') return null;
  const parsed = new URL(url);
  parsed.searchParams.sort();
  return fixtures.get(parsed.href) ?? null;
}
export const fixtureSha256 = createHash('sha256').update(JSON.stringify([...fixtures])).digest('hex');
export const fixtureNotes = ['Owned synthetic CMS and artwork only; decoded response bytes are not wire transfer.', 'No player iframe is in this fixture; real provider performance is NOT_ESTABLISHED.'];
export const spaPaths = Object.freeze(['/', '/blog', '/blog/article/1', '/discography', '/discography/1']);
