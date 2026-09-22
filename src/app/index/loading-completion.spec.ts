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

describe('Given route content completion has no artificial delay or stale callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});
  it.each([
    {scenario: 'synchronous content', route: 'glossary index', componentName: 'GlossaryComponent', component: GlossaryComponent, expectedInitialLoading: false, expectedLoadingAfterDestroy: true},
    {scenario: 'synchronous content', route: 'glossary Honi', componentName: 'HoniComponent', component: HoniComponent, expectedInitialLoading: false, expectedLoadingAfterDestroy: true},
    {scenario: 'synchronous content', route: 'glossary Gomamayo', componentName: 'GomamayoComponent', component: GomamayoComponent, expectedInitialLoading: false, expectedLoadingAfterDestroy: true},
  ])('When the $route route renders $componentName with synchronous content Then loading is $expectedInitialLoading and remains $expectedLoadingAfterDestroy after destroy', ({component, expectedInitialLoading, expectedLoadingAfterDestroy}) => {
    const fixture = TestBed.createComponent<unknown>(component);
    fixture.detectChanges();
    expect(TestBed.inject(LoadingService).loading).toBe(expectedInitialLoading);
    fixture.destroy();
    const loading = TestBed.inject(LoadingService);
    loading.loading = true;
    vi.advanceTimersByTime(600);
    expect(loading.loading).toBe(expectedLoadingAfterDestroy);
  });
  it.each([
    {
      scenario: 'settled response',
      route: 'home',
      componentName: 'HomeComponent',
      component: HomeComponent,
      requests: [
        {endpoint: 'https://cms.thinaticsystem.com/notifications', response: []},
        {endpoint: 'https://thinaticsystem.com/workers/patrons', response: []},
      ],
      expectedInitialLoading: false,
      expectedLoadingAfterDestroy: true,
    },
    {
      scenario: 'settled response',
      route: 'about',
      componentName: 'AboutComponent',
      component: AboutComponent,
      requests: [{endpoint: 'https://cms.thinaticsystem.com/about', response: {title: 'Synthetic about', body: ''}}],
      expectedInitialLoading: false,
      expectedLoadingAfterDestroy: true,
    },
  ])('When the $route route renders $componentName and its requests settle Then loading is $expectedInitialLoading and remains $expectedLoadingAfterDestroy after destroy', ({component, requests, expectedInitialLoading, expectedLoadingAfterDestroy}) => {
    const fixture = TestBed.createComponent<unknown>(component);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    for (const request of requests) http.expectOne(request.endpoint).flush(request.response);
    const loading = TestBed.inject(LoadingService);
    expect(loading.loading).toBe(expectedInitialLoading);
    fixture.destroy();
    loading.loading = true;
    vi.advanceTimersByTime(600);
    expect(loading.loading).toBe(expectedLoadingAfterDestroy);
    http.verify();
  });
  it.each([
    {
      route: 'home',
      componentName: 'HomeComponent',
      component: HomeComponent,
      endpoint: 'https://cms.thinaticsystem.com/notifications',
      secondaryRequests: [{endpoint: 'https://thinaticsystem.com/workers/patrons', response: []}],
      scenario: 'release error',
      outcome: 'error',
      errorResponse: {status: 503, statusText: 'Unavailable'},
      expectedLoadingAfterError: false,
      expectedErrorMessage: '読み込めませんでした',
      expectedRequestCancelled: null,
      expectedFinalLoading: false,
    },
    {
      route: 'home',
      componentName: 'HomeComponent',
      component: HomeComponent,
      endpoint: 'https://cms.thinaticsystem.com/notifications',
      secondaryRequests: [{endpoint: 'https://thinaticsystem.com/workers/patrons', response: []}],
      scenario: 'release cancel',
      outcome: 'cancel',
      errorResponse: null,
      expectedLoadingAfterError: null,
      expectedErrorMessage: null,
      expectedRequestCancelled: true,
      expectedFinalLoading: false,
    },
    {
      route: 'home',
      componentName: 'HomeComponent',
      component: HomeComponent,
      endpoint: 'https://cms.thinaticsystem.com/notifications',
      secondaryRequests: [{endpoint: 'https://thinaticsystem.com/workers/patrons', response: []}],
      scenario: 'release superseded',
      outcome: 'superseded',
      errorResponse: null,
      expectedLoadingAfterError: null,
      expectedErrorMessage: null,
      expectedRequestCancelled: true,
      expectedFinalLoading: true,
    },
    {
      route: 'about',
      componentName: 'AboutComponent',
      component: AboutComponent,
      endpoint: 'https://cms.thinaticsystem.com/about',
      secondaryRequests: [],
      scenario: 'release error',
      outcome: 'error',
      errorResponse: {status: 503, statusText: 'Unavailable'},
      expectedLoadingAfterError: false,
      expectedErrorMessage: '読み込めませんでした',
      expectedRequestCancelled: null,
      expectedFinalLoading: false,
    },
    {
      route: 'about',
      componentName: 'AboutComponent',
      component: AboutComponent,
      endpoint: 'https://cms.thinaticsystem.com/about',
      secondaryRequests: [],
      scenario: 'release cancel',
      outcome: 'cancel',
      errorResponse: null,
      expectedLoadingAfterError: null,
      expectedErrorMessage: null,
      expectedRequestCancelled: true,
      expectedFinalLoading: false,
    },
    {
      route: 'about',
      componentName: 'AboutComponent',
      component: AboutComponent,
      endpoint: 'https://cms.thinaticsystem.com/about',
      secondaryRequests: [],
      scenario: 'release superseded',
      outcome: 'superseded',
      errorResponse: null,
      expectedLoadingAfterError: null,
      expectedErrorMessage: null,
      expectedRequestCancelled: true,
      expectedFinalLoading: true,
    },
  ])('When the $route route renders $componentName and the request $outcome Then it preserves newer owner loading state', ({component, endpoint, secondaryRequests, outcome, errorResponse, expectedLoadingAfterError, expectedErrorMessage, expectedRequestCancelled, expectedFinalLoading}) => {
    const fixture = TestBed.createComponent<unknown>(component);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const loading = TestBed.inject(LoadingService);
    const request = http.expectOne(endpoint);
    for (const secondaryRequest of secondaryRequests) http.expectOne(secondaryRequest.endpoint).flush(secondaryRequest.response);
    if (outcome === 'error') {
      if (errorResponse === null || expectedLoadingAfterError === null || expectedErrorMessage === null) throw new Error('Error row is missing its expected failure result');
      request.flush({}, errorResponse);
      fixture.detectChanges();
      expect(loading.loading).toBe(expectedLoadingAfterError);
      expect(fixture.nativeElement.textContent).toContain(expectedErrorMessage);
      if (expectedRequestCancelled !== null) expect(request.cancelled).toBe(expectedRequestCancelled);
      expect(loading.loading).toBe(expectedFinalLoading);
      http.verify();
      return;
    }
    if (outcome === 'superseded') loading.loading = true;
    fixture.destroy();
    expect(request.cancelled).toBe(expectedRequestCancelled);
    expect(loading.loading).toBe(expectedFinalLoading);
    http.verify();
  });
});
