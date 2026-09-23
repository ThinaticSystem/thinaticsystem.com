import { MarkedRenderer } from "ngx-markdown";
import type { MarkedOptions } from "ngx-markdown";
import { environment } from "src/environments/environment";

export const markedOptionsFactory = (): MarkedOptions => {
  const renderer = new MarkedRenderer();

  // 相対リンクの場合はcmsホストに対する相対URLなのでcmsの絶対URLに置換する
  const imageRenderer = renderer.image;
  // NOTE: Marked binds its active parser through the invocation receiver, not this factory's renderer.
  renderer.image = function (token) {
    const isRelativeUrl = token.href.startsWith('/');
    return imageRenderer.call(this, {
      ...token,
      href: isRelativeUrl ? `${environment.cmsUrl}${token.href}` : token.href,
    });
  };

  // Markdownのリンクが外部リンクの場合、aタグのtarget="_blank"を付与する
  const linkRenderer = renderer.link;
  renderer.link = function (token) {
    const localLink = token.href.startsWith(`${location.protocol}//${location.hostname}`) || token.href.startsWith('/');
    const html = linkRenderer.call(this, token);
    return localLink ? html : html.replace(/^<a /, `<a target="_blank" rel="noreferrer noopener nofollow" `);
  };

  return {
    renderer: renderer,
  }
}
