import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {screen} from '@testing-library/angular';
import {vi} from 'vitest';
import DetailComponent from './detail.component';
import {LoadingService} from '../../services/loading.service';
import {environment} from '../../../environments/environment';

describe('Given discography detail loading owns an HTTP request', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: ActivatedRoute, useValue: {snapshot: {paramMap: convertToParamMap({id: '1'})}}}]});
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.restoreAllMocks();});
  it.each(['absent artwork', 'failed artwork'])('When content succeeds with %s Then detail loading settles the content', (artworkKind) => {
    const artwork = artworkKind === 'failed artwork' ? {url: '/synthetic-cover.png', alternativeText: 'Synthetic cover'} : null;
    const fixture = TestBed.createComponent(DetailComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController), loading = TestBed.inject(LoadingService);
    expect(loading.loading).toBe(true);
    http.expectOne(`${environment.cmsUrl}/discographies/1`).flush({title: 'Synthetic release', detail: '',
      release: '2024-01-01', artwork, detailComponent: [], buyComponent: [], dlComponent: [], demoComponent: []});
    fixture.detectChanges();
    expect(loading.loading).toBe(false);
    loading.loading = true;
    const image = screen.getByRole('img', {name: artwork ? 'Synthetic cover' : '画像がありません'});
    image.dispatchEvent(new Event('error'));
    image.dispatchEvent(new Event('load'));
    expect(loading.loading).toBe(true);
    http.verify();
  });
  it('When settles failed HTTP before its fallback navigation completes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DetailComponent);fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.cmsUrl}/discographies/1`).flush({}, {status: 503, statusText: 'Unavailable'});
    await Promise.resolve();
    expect(TestBed.inject(LoadingService).loading).toBe(false);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/discography']);
    expect(console.error).toHaveBeenCalledOnce();
    http.verify();
  });
  it('When cancels outgoing HTTP without clearing a newer load', () => {
    const fixture = TestBed.createComponent(DetailComponent);fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(`${environment.cmsUrl}/discographies/1`);
    const loading = TestBed.inject(LoadingService);loading.loading = true;
    fixture.destroy();
    expect(request.cancelled).toBe(true);
    expect(loading.loading).toBe(true);
    http.verify();
  });
});
