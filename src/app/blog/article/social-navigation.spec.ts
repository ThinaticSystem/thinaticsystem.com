import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Title} from '@angular/platform-browser';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {screen} from '@testing-library/angular';
import {environment} from '../../../environments/environment';
import {LoadingService} from '../../services/loading.service';
import TagComponent from '../tag/tag.component';
import IndexComponent from '../index/index.component';

const article = (id: number, tag: string) => ({id, title: `Article ${id}`, blogTags: [{tag}], body: '', created_at: '2024-01-01'});
const pageUrl = (page: number) => `${environment.cmsUrl}/blogs?_sort=published_at:desc&_limit=6&_start=${6 * (page - 1)}`;

describe('Social entry onward navigation contracts (inferred from reader journeys) Given the owner is initialized', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([
      {path: 'blog/tag/:tag', component: TagComponent}, {path: 'blog', component: IndexComponent},
    ])]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { try {http.verify();} finally {TestBed.resetTestingModule();} });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-tag-loading] distinguishes pending tag results from an empty success', async () => {
    const harness = await RouterTestingHarness.create('/blog/tag/Music');
    const request = http.expectOne(`${environment.cmsUrl}/blogs`);
    expect(screen.queryByText('記事が見つかりませんでした')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('読み込み中');
    request.flush([]); harness.detectChanges();
    expect(screen.getByText('記事が見つかりませんでした')).toBeTruthy();
    expect(screen.getByRole('link', {name: '記事一覧へ'}).getAttribute('href')).toBe('/blog');
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-tag-reuse] replaces a reused tag route and cancels stale data/title/loading ownership', async () => {
    const harness = await RouterTestingHarness.create('/blog/tag/Music');
    const first = http.expectOne(`${environment.cmsUrl}/blogs`);
    await harness.navigateByUrl('/blog/tag/Other', TagComponent);
    expect(first.cancelled).toBe(true);
    expect(TestBed.inject(LoadingService).loading).toBe(true);
    http.expectOne(`${environment.cmsUrl}/blogs`).flush([article(1, 'Music'), article(2, 'Other')]);
    harness.detectChanges();
    expect(screen.getByRole('heading', {level: 1, name: 'Other'})).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Article 2'})).toBeTruthy();
    expect(screen.queryByRole('link', {name: 'Article 1'})).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Other | ブログ | しなちくシステム');
    expect(TestBed.inject(LoadingService).loading).toBe(false);
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-tag-retry] owns failure, retry and destruction without unhandled HTTP errors', async () => {
    const harness = await RouterTestingHarness.create('/blog/tag/Music');
    http.expectOne(`${environment.cmsUrl}/blogs`).flush({}, {status: 503, statusText: 'Unavailable'});
    harness.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('記事を読み込めませんでした');
    expect(screen.queryByText('記事が見つかりませんでした')).toBeNull();
    expect(TestBed.inject(LoadingService).loading).toBe(false);
    screen.getByRole('button', {name: '再試行'}).click();
    const retry = http.expectOne(`${environment.cmsUrl}/blogs`);
    expect(TestBed.inject(LoadingService).loading).toBe(true);
    await harness.navigateByUrl('/blog', IndexComponent);
    expect(retry.cancelled).toBe(true);
    expect(TestBed.inject(LoadingService).loading).toBe(true);
    http.expectOne(pageUrl(1)).flush([]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(0);
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-tag-page-url] loads a literal tag and its page from URL; query-only history does not refetch', async () => {
    const tag = 'C++ / A&B?#日本';
    const harness = await RouterTestingHarness.create(`/blog/tag/${encodeURIComponent(tag)}?page=2&utm_source=sns`);
    http.expectOne(`${environment.cmsUrl}/blogs`).flush(Array.from({length: 7}, (_, index) => article(index + 1, tag)));
    harness.detectChanges();
    expect(screen.getByRole('heading', {level: 1, name: tag})).toBeTruthy();
    expect(screen.getAllByRole('link', {name: /^Article /})).toHaveLength(1);
    const component = await harness.navigateByUrl(`/blog/tag/${encodeURIComponent(tag)}?page=1&utm_source=sns`, TagComponent);
    http.expectNone(`${environment.cmsUrl}/blogs`);
    expect(component.page()).toBe(1);
    expect(screen.getAllByRole('link', {name: /^Article /})).toHaveLength(6);
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-list-page-url] opens page two cold and restores query transitions instead of resetting to page one', async () => {
    const harness = await RouterTestingHarness.create('/blog?page=2&utm_source=sns');
    http.expectOne(pageUrl(2)).flush([article(7, 'Music')]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(12);
    harness.detectChanges();
    expect(screen.getByRole('link', {name: 'Article 7'})).toBeTruthy();
    const component = await harness.navigateByUrl('/blog?page=1&utm_source=sns', IndexComponent);
    http.expectOne(pageUrl(1)).flush([article(1, 'Music')]);
    expect(component.page).toBe(1);
    await harness.navigateByUrl('/blog?page=2&utm_source=sns', IndexComponent);
    http.expectOne(pageUrl(2)).flush([article(7, 'Music')]);
    expect(component.page).toBe(2);
    expect(TestBed.inject(Router).url).toContain('utm_source=sns');
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that [social-list-invalid-page] normalizes invalid page with replacement while preserving unrelated query', async () => {
    const harness = await RouterTestingHarness.create('/blog?page=NaN&utm_source=sns');
    http.expectOne(pageUrl(1)).flush([]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(0);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/blog?utm_source=sns');
  });
});
