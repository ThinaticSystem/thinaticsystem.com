import { MarkedOptions, MarkedRenderer } from "ngx-markdown";

export const markedOptionsFactory = (): MarkedOptions => {
  // Markdownのリンクが外部リンクの場合、aタグのtarget="_blank"を付与する
  const renderer = new MarkedRenderer();
  const linkRenderer = renderer.link;
  renderer.link = (href: string, title, text) => {
    let localLink = false;
    if (href.startsWith(`${location.protocol}//${location.hostname}`) || href.startsWith(`/`)) localLink = true;
    const html = linkRenderer.call(renderer, href, title, text);
    return localLink ? html : html.replace(/^<a /, `<a target="_blank" rel="noreferrer noopener nofollow" `);
  };
  return {
    renderer: renderer,
  }
}
