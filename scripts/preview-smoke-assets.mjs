export function extractSameOriginAssets(rootHtml, origin) {
  const scriptTags = [...rootHtml.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
  const moduleScripts = scriptTags
    .filter(tag => /\btype=["']module["']/i.test(tag))
    .map(tag => tag.match(/\bsrc=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map(value => new URL(value, origin))
    .filter(url => url.origin === origin.origin);
  const linkTags = [...rootHtml.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  const stylesheets = linkTags
    .filter(tag => /\brel=["'][^"']*stylesheet[^"']*["']/i.test(tag))
    .map(tag => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map(value => new URL(value, origin))
    .filter(url => url.origin === origin.origin);
  return {moduleScripts, stylesheets};
}
