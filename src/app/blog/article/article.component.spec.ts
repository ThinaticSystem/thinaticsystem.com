import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {render} from '@testing-library/angular';
import {BehaviorSubject, throwError} from 'rxjs';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Title} from '@angular/platform-browser';
import {LoadingService} from '../../services/loading.service';
import {NavigateService} from '../../services/navigate.service';
import ArticleComponent from './article.component';
import {environment} from '../../../environments/environment';

describe('ArticleComponent', () => {
  let http: HttpTestingController;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let fixture: {detectChanges: () => void};

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({id: '1'}));
    const rendered = await render(ArticleComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {paramMap: routeParams.asObservable(), snapshot: {paramMap: convertToParamMap({id: '1'})}}},
      ],
    });
    fixture = rendered.fixture;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify({ignoreCancelled: true});
  });

  it('creates the page after its initial request settles', () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({id: 1, title: 'fixture', body: '', blogTags: [], created_at: ''});
    fixture.detectChanges();

    expect(fixture).toBeTruthy();
  });

  it('distinguishes a missing article from a server failure', async () => {
    http.expectOne(`${environment.cmsUrl}/blogs/1`).flush({id: 1, title: 'fixture', body: '', blogTags: [], created_at: ''});
    const navigations: string[][] = [];
    const title = {setTitle: () => undefined} as unknown as Title;
    const loading = {loading: true} as unknown as LoadingService;
    const navigate = {go: (path: string) => navigations.push([path])} as unknown as NavigateService;
    const route = {snapshot: {paramMap: convertToParamMap({id: '1'})}} as unknown as ActivatedRoute;
    const suppressUnhandled = () => undefined;
    process.on('uncaughtException', suppressUnhandled);
    const runFailure = async (status: number) => {
      const http = {get: () => {
        return throwError(() => new HttpErrorResponse({status, error: {message: 'fixture'}}));
      }} as unknown as HttpClient;
      new ArticleComponent(route, http, title, navigate, loading).ngOnInit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    try {
      await runFailure(404);
      await runFailure(500);

      expect(navigations).toEqual([['/404']]);
    } finally {
      process.off('uncaughtException', suppressUnhandled);
    }
  });
});
