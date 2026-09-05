import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {render} from '@testing-library/angular';
import {BehaviorSubject} from 'rxjs';
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
});
