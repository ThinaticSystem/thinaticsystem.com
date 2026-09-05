import {ComponentFixture, TestBed} from '@angular/core/testing';

import {BlogCardComponent} from './blog-card.component';
import {Blog} from '../../interfaces/blog';
import {formatDate} from '@angular/common';

describe('BlogCardComponent', () => {
  let component: BlogCardComponent;
  let fixture: ComponentFixture<BlogCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogCardComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BlogCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a year boundary using the host runtime time zone', () => {
    const boundary = '2024-12-31T23:30:00.000Z';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const data: Blog = {
      id: 1,
      title: 'Boundary fixture',
      body: '',
      published_at: boundary,
      created_at: boundary,
      updated_at: boundary,
      blogTags: [],
      eyecatch: null,
    };
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.date').textContent.trim()).toBe(formatDate(boundary, 'yyyy/MM/dd', 'en-US', timeZone));
  });
});
