import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import type {ComponentFixture} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import {BehaviorSubject} from 'rxjs';
import {vi} from 'vitest';
import {Title} from '@angular/platform-browser';
import {LoadingService} from '../../services/loading.service';
import {NavigateService} from '../../services/navigate.service';
import ArticleComponent from './article.component';
import {environment} from '../../../environments/environment';

const blog = (id: number) => ({id, title: `Fixture ${id}`, body: '', blogTags: [], created_at: ''});
describe('ArticleComponent', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let fixture: ComponentFixture<ArticleComponent>;
  let loading: LoadingService;
  const go = vi.fn();
  beforeEach(async () => {
    go.mockReset();
    params = new BehaviorSubject(convertToParamMap({id: '1'}));
    const rendered = await render(ArticleComponent, {providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      {provide: NavigateService, useValue: {go}},
      {provide: ActivatedRoute, useValue: {paramMap: params.asObservable(), snapshot: {paramMap: convertToParamMap({id: '1'})}}},
    ]});
    fixture = rendered.fixture;
    http = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });
  afterEach(() => { try {http.verify();} finally {TestBed.resetTestingModule();} });

  it('[social-article-local-exit] offers an explicit list destination while pending and after failure', () => {
    expect(screen.getByRole('link', {name: '記事一覧へ'}).getAttribute('href')).toBe('/blog');
    expect(screen.getByRole('status').textContent).toContain('読み込み中');
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({}, {status: 503, statusText: 'Unavailable'});
    fixture.detectChanges();
    expect(screen.getByRole('link', {name: '記事一覧へ'}).getAttribute('href')).toBe('/blog');
  });

  it('[social-article-literal-tag] keeps reserved characters in a single tag path segment', () => {
    const tag = 'C++ / A&B?#日本';
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({...blog(1), blogTags: [{tag}]});
    fixture.detectChanges();
    const url = new URL(screen.getByRole('link', {name: tag}).getAttribute('href')!, 'https://example.test');
    expect(url.pathname.slice('/blog/tag/'.length)).not.toContain('/');
    expect(decodeURIComponent(url.pathname.slice('/blog/tag/'.length))).toBe(tag);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });

  it('creates the page after its initial request settles', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush(blog(1));
    fixture.detectChanges();
    expect(screen.getByRole('heading', {name: 'Fixture 1'})).toBeTruthy();
  });

  it('renders nonempty markdown, the formatted date and native tag links', async () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({...blog(1),
      created_at: '2024-01-02T12:00:00Z',
      body: '[Article source](https://example.test/source)',
      blogTags: [{tag: 'Music'}],
    });
    fixture.detectChanges();
    expect(screen.getByText('2024年01月02日')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Music'}).getAttribute('href')).toBe('/blog/tag/Music');
    expect((await screen.findByRole('link', {name: 'Article source'})).getAttribute('href')).toBe('https://example.test/source');
  });

  it('[article-title-level-one] provides the page heading without relying on headings in the article body', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush(blog(1));
    fixture.detectChanges();
    expect(screen.queryAllByRole('heading', {level: 1, name: 'Fixture 1'})).toHaveLength(1);
  });

  it('[article-sharing-heading-order] introduces sharing as a section below the page heading', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush(blog(1));
    fixture.detectChanges();
    expect(screen.getByRole('heading', {level: 1, name: 'Fixture 1'})).toBeTruthy();
    expect(screen.queryAllByRole('heading', {level: 2, name: 'Share'})).toHaveLength(1);
  });

  it('[article-route-parameter-transition] resets old content and reloads title and share URL on reused routes', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush(blog(1));
    params.next(convertToParamMap({id: '2'}));
    expect(fixture.componentInstance.blog()).toBeNull();
    expect(loading.loading).toBe(true);
    http.expectOne(`${environment.cmsUrl}/blogs/2`).flush(blog(2));
    expect(fixture.componentInstance.blog()?.id).toBe(2);
    expect(TestBed.inject(Title).getTitle()).toBe('Fixture 2 | しなちくシステム');
    expect(new URL(fixture.componentInstance.url).pathname).toBe('/blog/article/2');
    expect(loading.loading).toBe(false);
  });

  it('cancels late article effects, ignores repeated IDs and cancels on destroy', () => {
    const first = http.expectOne(`${environment.cmsUrl}/blogs/1`);
    params.next(convertToParamMap({id: '2'}));
    const second = http.expectOne(`${environment.cmsUrl}/blogs/2`);
    expect(first.cancelled).toBe(true);
    expect(loading.loading).toBe(true);
    params.next(convertToParamMap({id: '2'}));
    http.expectNone(`${environment.cmsUrl}/blogs/2`);
    fixture.destroy();
    expect(second.cancelled).toBe(true);
    params.next(convertToParamMap({id: '3'}));
    http.expectNone(`${environment.cmsUrl}/blogs/3`);
    expect(go).not.toHaveBeenCalled();
  });

  it('[article-404-loading-cleanup] handles 404 without unhandled errors and releases loading after redirect', async () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({message: 'missing'}, {status: 404, statusText: 'Not found'});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(go).toHaveBeenCalledExactlyOnceWith('/404');
    expect(loading.loading).toBe(false);
    expect(fixture.componentInstance.blog()).toBeNull();
  });

  it('distinguishes server failure from missing content and retries the current ID', async () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({}, {status: 500, statusText: 'Error'});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(go).not.toHaveBeenCalled();
    expect(loading.loading).toBe(false);
    fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('記事を読み込めませんでした');
    screen.getByRole('button', {name: '再試行'}).click();
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush(blog(1));
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', {name: 'Fixture 1'})).toBeTruthy();
  });

  it('handles a missing route ID without requesting a null article', () => {
    const pending = http.expectOne(`${environment.cmsUrl}/blogs/1`);
    params.next(convertToParamMap({}));
    expect(pending.cancelled).toBe(true);
    http.expectNone(`${environment.cmsUrl}/blogs/null`);
    expect(go).toHaveBeenCalledExactlyOnceWith('/404');
    expect(loading.loading).toBe(false);
  });
  it('omits null entries and null, absent, empty, whitespace labels from CMS chips', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({...blog(1), blogTags:
      [null, {tag: null}, {}, {tag: ''}, {tag: '  \t\n'}, {tag: 'LXC'}]});
    fixture.detectChanges();
    expect(screen.queryAllByRole('link', {name: ''})).toHaveLength(0);
    expect(screen.getByRole('link', {name: 'LXC'}).getAttribute('href')).toBe('/blog/tag/LXC');
  });

});
