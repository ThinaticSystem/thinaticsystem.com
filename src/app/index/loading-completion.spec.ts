import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {vi} from 'vitest';
import HomeComponent from './index.component';
import AboutComponent from '../about/about.component';
import GlossaryComponent from '../glossary/index/index.component';
import HoniComponent from '../glossary/honi/honi.component';
import GomamayoComponent from '../glossary/gomamayo/gomamayo.component';
import {LoadingService} from '../services/loading.service';
import {environment} from '../../environments/environment';

describe('Route completion has no artificial delay or stale callbacks Given the owner is initialized', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});
  for (const component of [GlossaryComponent, HoniComponent, GomamayoComponent]) {
    it(`${component.name} completes synchronous content immediately`, () => {
      const fixture = TestBed.createComponent<unknown>(component);
      fixture.detectChanges();
      expect(TestBed.inject(LoadingService).loading).toBe(false);
      fixture.destroy();
      const loading = TestBed.inject(LoadingService);
      loading.loading = true;
      vi.advanceTimersByTime(600);
      expect(loading.loading).toBe(true);
    });
  }
  for (const component of [HomeComponent, AboutComponent]) {
    it(`${component.name} settles on the response and cannot hide a later route`, () => {
      const fixture = TestBed.createComponent<unknown>(component);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      if (component === HomeComponent) {
        http.expectOne(`${environment.cmsUrl}/notifications`).flush([]);
        http.expectOne(`${environment.publicUrl}/workers/patrons`).flush([]);
      } else {
        http.expectOne(`${environment.cmsUrl}/about`).flush({title: 'Synthetic about', body: ''});
      }
      const loading = TestBed.inject(LoadingService);
      expect(loading.loading).toBe(false);
      fixture.destroy();
      loading.loading = true;
      vi.advanceTimersByTime(600);
      expect(loading.loading).toBe(true);
      http.verify();
    });
  }
  for (const component of [HomeComponent, AboutComponent]) {
    for (const outcome of ['error', 'cancel', 'superseded'] as const) {
      it(`${component.name} releases ${outcome} without releasing a newer owner`, () => {
        const fixture = TestBed.createComponent<unknown>(component);
        fixture.detectChanges();
        const http = TestBed.inject(HttpTestingController);
        const loading = TestBed.inject(LoadingService);
        const request = http.expectOne(`${environment.cmsUrl}/${component === HomeComponent ? 'notifications' : 'about'}`);
        if (component === HomeComponent) http.expectOne(`${environment.publicUrl}/workers/patrons`).flush([]);
        if (outcome === 'error') {
          request.flush({}, {status: 503, statusText: 'Unavailable'});
          fixture.detectChanges();
          expect(loading.loading).toBe(false);
          expect(fixture.nativeElement.textContent).toContain('読み込めませんでした');
        } else {
          if (outcome === 'superseded') loading.loading = true;
          fixture.destroy();
          expect(request.cancelled).toBe(true);
          expect(loading.loading).toBe(outcome === 'superseded');
        }
        http.verify();
      });
    }
  }

});
