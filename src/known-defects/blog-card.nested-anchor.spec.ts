import {render, screen} from '@testing-library/angular';
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

    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
