import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MarkdownService} from "ngx-markdown";



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
    // Markdownのリンクが外部リンクの場合、aタグのtarget="_blank"を付与する
    const renderer = this.markdownService.renderer;
    const linkRenderer = renderer.link;
    renderer.link = (href: string, title, text) => {
      let localLink = false;
      if (href.startsWith(`${location.protocol}//${location.hostname}`) || href.startsWith(`/`)) localLink = true;
      const html = linkRenderer.call(renderer, href, title, text);
      return localLink ? html : html.replace(/^<a /, `<a target="_blank" rel="noreferrer noopener nofollow" `);
    };
  }
}
