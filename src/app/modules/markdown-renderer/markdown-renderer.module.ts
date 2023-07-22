import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MarkdownService} from "ngx-markdown";
import {environment} from 'src/environments/environment'


@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ]
})
export class MarkdownRendererModule {
  constructor(
    private markdownService: MarkdownService
  ) {
    const renderer = this.markdownService.renderer;

    // 処理をカスタマイズするために関数をオーバーライドする

    //// 相対リンクの場合はcmsホストに対する相対URLなのでcmsの絶対URLに置換する
    const imageRenderer = renderer.image;
    renderer.image = (href: string | null, title: string | null, text: string) => {
      const isRelativeUrl = href?.startsWith('/');
      return imageRenderer.call(
        renderer,
        isRelativeUrl ? `${environment.cmsUrl}${href}` : href,
        title,
        text);
    };

    //// Markdownのリンクが外部リンクの場合、aタグのtarget="_blank"を付与する
    const linkRenderer = renderer.link;
    renderer.link = (href: string, title, text) => {
      let localLink = false;
      if (href.startsWith(`${location.protocol}//${location.hostname}`) || href.startsWith(`/`)) localLink = true;
      const html = linkRenderer.call(renderer, href, title, text);
      return localLink ? html : html.replace(/^<a /, `<a target="_blank" rel="noreferrer noopener nofollow" `);
    };
  }
}
