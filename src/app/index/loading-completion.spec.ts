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

describe('Given route content completion has no artificial delay or stale callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});
  it.each([
    {componentName: '_IndexComponent'},
    {componentName: '_HoniComponent'},
    {componentName: '_GomamayoComponent'},
  ])('When $componentName receives synchronous content Then it completes immediately', ({componentName}) => {
    const component = componentName === '_IndexComponent' ? GlossaryComponent : componentName === '_HoniComponent' ? HoniComponent : GomamayoComponent;
    const fixture = TestBed.createComponent<unknown>(component);
    fixture.detectChanges();
    expect(TestBed.inject(LoadingService).loading).toBe(false);
    fixture.destroy();
    const loading = TestBed.inject(LoadingService);
    loading.loading = true;
    vi.advanceTimersByTime(600);
    expect(loading.loading).toBe(true);
  });
  it.each([
    {componentName: '_IndexComponent'},
    {componentName: '_AboutComponent'},
  ])('When $componentName settles a response Then it cannot hide a later route', ({componentName}) => {
    const component = componentName === '_IndexComponent' ? HomeComponent : AboutComponent;
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
  it.each([
    {componentName: '_IndexComponent', outcome: 'error'},
    {componentName: '_IndexComponent', outcome: 'cancel'},
    {componentName: '_IndexComponent', outcome: 'superseded'},
    {componentName: '_AboutComponent', outcome: 'error'},
    {componentName: '_AboutComponent', outcome: 'cancel'},
    {componentName: '_AboutComponent', outcome: 'superseded'},
  ])('When $componentName releases $outcome Then it does not release a newer owner', ({componentName, outcome}) => {
    const component = componentName === '_IndexComponent' ? HomeComponent : AboutComponent;
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
});
