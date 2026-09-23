export function parseArticleList(payload) {
  if (!Array.isArray(payload) || payload.length === 0) throw new Error('CMS article list must be a non-empty JSON array');
  return payload.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || !Number.isSafeInteger(entry.id) || entry.id <= 0 || typeof entry.title !== 'string' || entry.title.trim() === '' || typeof entry.body !== 'string' || entry.body.trim() === '') {
      throw new Error('CMS article list contains an invalid article at index ' + index);
    }
    return {id: entry.id, title: entry.title, body: entry.body};
  });
}

export function assertArticleDetailMatches(article, detail) {
  if (!detail || typeof detail !== 'object' || detail.id !== article.id || detail.title !== article.title || detail.body !== article.body) {
    throw new Error('CMS article detail does not match the selected list article');
  }
}
