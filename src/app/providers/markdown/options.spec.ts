import {Marked} from 'marked';
import {markedOptionsFactory} from './options';
import {environment} from '../../../environments/environment';

/** Exercise the actual production overrides, not ngx-markdown's default test provider. */
describe('Given the Markdown renderer receives link and image tokens', () => {
  it('When [social-markdown-link-receiver] renders inline links through the active parser and preserves local navigation', async () => {
    const parser = new Marked({renderer: markedOptionsFactory().renderer});
    const html = await parser.parse('[**次の記事**](/blog/article/2)');
    expect(html).toContain('<a href="/blog/article/2"><strong>次の記事</strong></a>');
    expect(html).not.toContain('target=');
  });

  it('When [social-markdown-external-policy] keeps external tab and rel policy without losing body content', async () => {
    const parser = new Marked({renderer: markedOptionsFactory().renderer});
    const html = await parser.parse('本文\n\n[外部の *資料*](https://example.test/path?a=1&b=2)');
    expect(html).toContain('<p>本文</p>');
    expect(html).toContain('target="_blank" rel="noreferrer noopener nofollow"');
    expect(html).toContain('外部の <em>資料</em>');
  });

  it('When [social-markdown-image-receiver] renders image alt tokens with CMS-relative URL policy', async () => {
    const parser = new Marked({renderer: markedOptionsFactory().renderer});
    const html = await parser.parse('![**日本の画像**](/uploads/example.png)');
    expect(html).toContain(`src="${environment.cmsUrl}/uploads/example.png"`);
    expect(html).toContain('alt="日本の画像"');
  });
});
