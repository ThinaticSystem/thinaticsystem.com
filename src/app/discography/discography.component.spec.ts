import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import type {ComponentFixture} from '@angular/core/testing';
import {render, screen} from '@testing-library/angular';
import {provideRouter} from '@angular/router';
import DiscographyComponent from './discography.component';
import {environment} from '../../environments/environment';
import {LoadingService} from '../services/loading.service';

const release = (id: number, withArtwork = true) => ({id, title: `Release ${id}`, release: '2024-01-01', artwork: withArtwork ? {alternativeText: `Artwork ${id}`, formats: {small: {url: `/uploads/${id}.png`}}} : null});
describe('Given the discography view receives releases and artwork results', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<DiscographyComponent>;
  let loading: LoadingService;
  beforeEach(async () => {
    const rendered = await render(DiscographyComponent, {providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]});
    fixture = rendered.fixture;
    http = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });
  afterEach(() => {http.verify();});

  it('When preserves artwork and fallback image attributes and descending release order', () => {
    const later = {...release(2, false), release: '2025-01-01'};
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([release(1), later]);
    fixture.detectChanges();
    const artwork = screen.getByRole('img', {name: 'Artwork 1'});
    const fallback = screen.getByRole('img', {name: '画像がありません'});
    expect(artwork.getAttribute('src')).toBe(`${environment.cmsUrl}/uploads/1.png`);
    expect(artwork.getAttribute('width')).toBe('100%');
    expect(fallback.getAttribute('src')).toBe(`${environment.cmsUrl}/uploads/noimage_f16114bd25.png`);
    expect(fallback.getAttribute('width')).toBeNull();
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/discography/2', '/discography/1']);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    fallback.dispatchEvent(new Event('load'));
    expect(loading.loading).toBe(true);
    artwork.dispatchEvent(new Event('error'));
    expect(loading.loading).toBe(false);
  });

  it('When [discography-empty-loading] settles an empty result without inventing an image completion', () => {
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([]);
    expect(loading.loading).toBe(false);
    fixture.detectChanges();
    expect(screen.getByText('まだ作品がありません')).toBeTruthy();
  });

  it('When [discography-image-error-loading] settles each failed image once including fallback artwork', () => {
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([release(1), release(2, false)]);
    fixture.detectChanges();
    const first = screen.getByRole('img', {name: 'Artwork 1'});
    const second = screen.getByRole('img', {name: '画像がありません'});
    expect(first.getAttribute('src')).toBe(`${environment.cmsUrl}/uploads/1.png`);
    first.dispatchEvent(new Event('error'));
    first.dispatchEvent(new Event('load'));
    first.dispatchEvent(new Event('error'));
    expect(loading.loading).toBe(true);
    second.dispatchEvent(new Event('error'));
    expect(loading.loading).toBe(false);
    loading.loading = true;
    second.dispatchEvent(new Event('load'));
    expect(loading.loading).toBe(true);
  });

  it('When settles a mixture of successful and failed images without changing destinations', () => {
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([release(1), release(2)]);
    fixture.detectChanges();
    screen.getByRole('img', {name: 'Artwork 1'}).dispatchEvent(new Event('load'));
    expect(loading.loading).toBe(true);
    screen.getByRole('img', {name: 'Artwork 2'}).dispatchEvent(new Event('error'));
    expect(loading.loading).toBe(false);
    expect(screen.getByRole('link', {name: /Release 1/}).getAttribute('href')).toBe('/discography/1');
  });

  it('When handles HTTP failure without unhandled errors, distinguishes empty success and retries', async () => {
    http.expectOne(`${environment.cmsUrl}/discographies`).flush({}, {status: 503, statusText: 'Unavailable'});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(loading.loading).toBe(false);
    fixture.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('作品を読み込めませんでした');
    expect(screen.queryByText('まだ作品がありません')).toBeNull();
    screen.getByRole('button', {name: '再試行'}).click();
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([]);
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('まだ作品がありません')).toBeTruthy();
  });

  it('When cancels pending HTTP and ignores image events after destruction', () => {
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([release(1)]);
    fixture.detectChanges();
    const image = screen.getByRole('img', {name: 'Artwork 1'});
    fixture.destroy();
    loading.loading = true;
    image.dispatchEvent(new Event('error'));
    expect(loading.loading).toBe(true);
  });

  it('When cancels a still-pending response on destruction', () => {
    const pending = http.expectOne(`${environment.cmsUrl}/discographies`);
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
  });
});
