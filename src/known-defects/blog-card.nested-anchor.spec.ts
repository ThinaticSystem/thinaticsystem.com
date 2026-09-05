import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {BlogCardComponent} from '../app/components/blog-card/blog-card.component';
import {Blog} from '../app/interfaces/blog';

describe('Known defects: BlogCardComponent', () => {
  it('still exposes the nested interactive-anchor defect', async () => {
    const data: Blog = {
      id: 1,
      title: 'Known defect fixture',
      body: 'Fixture body',
      published_at: '',
      created_at: '',
      updated_at: '',
      blogTags: [{id: 1, tag: 'fixture'}],
      eyecatch: null,
    };
    await render(BlogCardComponent, {
      componentInputs: {data},
    });

    const articleLink = screen.getByRole('link', {name: /Known defect fixture/});
    const tagLink = screen.getByRole('link', {name: /^fixture$/});
    expect(articleLink.getAttribute('href')).toBe('/blog/article/1');
    expect(tagLink.getAttribute('href')).toBe('/blog/tag/fixture');
    expect(articleLink.contains(tagLink)).toBe(false);

    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(articleLink);
    await user.tab();
    expect(document.activeElement).toBe(tagLink);
  });
});
