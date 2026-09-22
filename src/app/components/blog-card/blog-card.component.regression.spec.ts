import {render, screen} from '@testing-library/angular';
import {BlogCardComponent} from './blog-card.component';

describe('BlogCardComponent regression witnesses Given the owner is initialized', () => {
  it('When the recorded scenario is exercised Then the contract demonstrates that keeps tag navigation outside the article link after rendering a tagged card', async () => {
    await render(BlogCardComponent, {componentInputs: {data: {
      id: 1, title: 'Regression article', body: '',
      published_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z',
      blogTags: [{id: 1, tag: 'fixture'}], eyecatch: null,
    }}});
    const articleLink = screen.getByRole('link', {name: 'Regression article'});
    const tagLink = screen.getByRole('link', {name: 'fixture'});
    expect(articleLink.contains(tagLink)).toBe(false);
    expect(tagLink.getAttribute('href')).toContain('/blog/tag/fixture');
  });
});
