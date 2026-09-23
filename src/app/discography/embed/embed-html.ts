import {admitPlayerUrl} from './embed-policy';
import type {MediaEmbed} from './embed-policy';

export type EmbedAdmission = Readonly<{type: 'empty'} | {type: 'blocked'} | {type: 'media'; media: MediaEmbed}>;

/** Parse in an inert template; no CMS node or attribute is attached to the live document. */
export function readEmbedHtml(value: unknown, document: Document): EmbedAdmission {
  if (value === null || value === undefined || value === '') return {type: 'empty'};
  if (typeof value !== 'string' || value.length > 16_384) return {type: 'blocked'};
  if (value.trim() === '') return {type: 'empty'};
  const template = document.createElement('template');
  template.innerHTML = value;
  const nodes = [...template.content.childNodes].filter(node => node.nodeType !== 3 || node.textContent?.trim() !== '');
  if (nodes.length !== 1) return {type: 'blocked'};
  const frame = nodes[0];
  if (!frame || frame.nodeType !== 1) return {type: 'blocked'};
  const element = frame as Element;
  if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || element.localName !== 'iframe' || element.textContent?.trim()) return {type: 'blocked'};
  if ([...element.attributes].some(attribute => attribute.name === 'srcdoc' || attribute.name.startsWith('on'))) return {type: 'blocked'};
  const src = element.getAttribute('src');
  const media = src === null ? null : admitPlayerUrl(src);
  return media === null ? {type: 'blocked'} : {type: 'media', media};
}
