import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {BlogCardComponent} from './blog-card.component';
import type {Blog} from '../../interfaces/blog';

const data: Blog = {id: 1, title: '記事の見出し', body: '', published_at: '', created_at: '', updated_at: '', blogTags: [{id: 1, tag: 'fixture'}], eyecatch: null};
describe('Given a blog card receives optional tag metadata', () => {
  it('When [blog-card-nested-anchor] exposes independent article and tag links in keyboard order', async () => {
    await render(BlogCardComponent, {componentInputs: {data}});
    const article = screen.getByRole('link', {name: /記事の見出し/});
    const tag = screen.getByRole('link', {name: 'fixture'});
    expect(article.getAttribute('href')).toBe('/blog/article/1');
    expect(tag.getAttribute('href')).toBe('/blog/tag/fixture');
    expect(article.contains(tag)).toBe(false);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(article);
    await user.tab();
    expect(document.activeElement).toBe(tag);
  });
  it('When does not render an absent input and preserves a tag-free article destination', async () => {
    const rendered = await render(BlogCardComponent);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    rendered.fixture.componentRef.setInput('data', {...data, id: 2, blogTags: []});
    rendered.fixture.detectChanges();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', {name: /記事の見出し/}).getAttribute('href')).toBe('/blog/article/2');
  });
  it('When omits null, missing, empty and whitespace tag labels but preserves valid destinations', async () => {
    await render(BlogCardComponent, {componentInputs: {data: {...data, blogTags:
      [null, {tag: ''}, {tag: '  \t\n'}, {tag: 'C++ / A&B?#日本'}]}}});
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryAllByRole('link', {name: ''})).toHaveLength(0);
    expect(screen.getByRole('link', {name: 'C++ / A&B?#日本'}).getAttribute('href')).toContain('/blog/tag/');
  });

});
