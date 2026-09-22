import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import type {ComponentFixture} from '@angular/core/testing';
import {render, screen} from '@testing-library/angular';
import {provideRouter} from '@angular/router';
import IndexComponent from './index.component';
import {environment} from '../../../environments/environment';
import {LoadingService} from '../../services/loading.service';

const pageUrl = (page: number) => `${environment.cmsUrl}/blogs?_sort=published_at:desc&_limit=6&_start=${6 * (page - 1)}`;
const blog = (id: number) => ({id, title: `Fixture ${id}`, body: '', blogTags: [], created_at: ''});

describe('IndexComponent', () => {
  let http: HttpTestingController;
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;
  let loading: LoadingService;
  beforeEach(async () => {
    const rendered = await render(IndexComponent, {providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]});
    fixture = rendered.fixture;
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });
  afterEach(() => { http.verify(); });

  it('Given the blog index receives article and count responses when page or count requests settle Then creates the page after its initial requests settle', () => {
    http.expectOne(pageUrl(1)).flush([]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(0);
    fixture.detectChanges();
    expect(component.blogs()).toEqual([]);
    expect(component.totalItems()).toBe(0);
    expect(loading.loading).toBe(false);
    expect(screen.getByText('まだ記事がありません')).toBeTruthy();
  });

  it('Given the blog index receives article and count responses when page or count requests settle Then [blog-http-error-loading] handles a failed page without an unhandled error and releases loading', async () => {
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(0);
    http.expectOne(pageUrl(1)).flush({message: 'fixture'}, {status: 503, statusText: 'Unavailable'});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(loading.loading).toBe(false);
    fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('記事を読み込めませんでした');
    expect(screen.queryByText('まだ記事がありません')).toBeNull();
    screen.getByRole('button', {name: '再試行'}).click();
    expect(loading.loading).toBe(true);
    http.expectOne(pageUrl(1)).flush([blog(1)]);
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Given the blog index receives article and count responses when page or count requests settle Then handles a count failure separately and retries without hiding successful articles', async () => {
    http.expectOne(pageUrl(1)).flush([blog(1)]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush({}, {status: 500, statusText: 'Error'});
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(loading.loading).toBe(false);
    expect(screen.getByRole('link', {name: /Fixture 1/})).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('件数を読み込めませんでした');
    screen.getByRole('button', {name: '件数を再試行'}).click();
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(12);
    fixture.detectChanges();
    expect(component.totalItems()).toBe(12);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Given the blog index receives article and count responses when page or count requests settle Then [blog-concurrent-page-order] cancels the older page and only the current request settles loading', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(12);
    const first = http.expectOne(pageUrl(1));
    component.loadPage(2);
    const second = http.expectOne(pageUrl(2));
    expect(first.cancelled).toBe(true);
    expect(loading.loading).toBe(true);
    second.flush([blog(2)]);
    expect(component.blogs()?.map(item => item.id)).toEqual([2]);
    expect(component.page).toBe(2);
    expect(loading.loading).toBe(false);
  });

  it('Given the blog index receives article and count responses when page or count requests settle Then does not display empty success while pending and cancels both requests on destroy', () => {
    expect(screen.queryByText('まだ記事がありません')).toBeNull();
    const page = http.expectOne(pageUrl(1));
    const count = http.expectOne(`${environment.cmsUrl}/blogs/count`);
    fixture.destroy();
    expect(page.cancelled).toBe(true);
    expect(count.cancelled).toBe(true);
  });
});
