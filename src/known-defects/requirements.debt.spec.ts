import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {DomSanitizer, Title} from '@angular/platform-browser';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {render} from '@testing-library/angular';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, config as rxjsConfig, of, Subject, throwError} from 'rxjs';
import {afterEach, vi} from 'vitest';
import IndexComponent from '../app/blog/index/index.component';
import ArticleComponent from '../app/blog/article/article.component';
import DiscographyComponent from '../app/discography/discography.component';
import {SanitizeHtmlPipe} from '../app/pipes/sanitize-html.pipe';
import {Blog} from '../app/interfaces/blog';
import {Discography} from '../app/interfaces/discography';
import {LoadingService} from '../app/services/loading.service';
import {NavigateService} from '../app/services/navigate.service';
import {NotificationService} from '../app/services/notification.service';
import {environment} from '../environments/environment';

const title = {setTitle: () => undefined} as unknown as Title;
const navigate = {go: () => undefined} as unknown as NavigateService;

const initialRxjsUnhandledError = rxjsConfig.onUnhandledError;

afterEach(() => {
  expect(rxjsConfig.onUnhandledError).toBe(initialRxjsUnhandledError);
});

const flushUnhandledErrors = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const runWithExpectedRxjsErrors = async (
  expectedErrors: readonly unknown[],
  run: () => Promise<void> | void,
): Promise<unknown[]> => {
  const originalHandler = rxjsConfig.onUnhandledError;
  const observedErrors: unknown[] = [];
  rxjsConfig.onUnhandledError = (error: unknown): void => {
    if (expectedErrors.includes(error)) {
      observedErrors.push(error);
      return;
    }
    if (originalHandler) {
      originalHandler(error);
      return;
    }
    throw error;
  };
  try {
    await run();
    return observedErrors;
  } finally {
    rxjsConfig.onUnhandledError = originalHandler;
  }
};

const blog = (id: number): Blog => ({
  id,
  title: `Fixture ${id}`,
  body: '',
  published_at: '',
  created_at: '',
  updated_at: '',
  blogTags: [],
  eyecatch: null,
});

const artwork = {
  alternativeText: 'fixture',
  width: 1,
  height: 1,
  url: '/uploads/fixture.png',
  formats: {
    large: {ext: '.png', url: '/uploads/fixture.png', hash: 'fixture', mime: 'image/png', name: 'fixture', size: 1, width: 1, height: 1},
    small: {ext: '.png', url: '/uploads/fixture.png', hash: 'fixture', mime: 'image/png', name: 'fixture', size: 1, width: 1, height: 1},
    medium: {ext: '.png', url: '/uploads/fixture.png', hash: 'fixture', mime: 'image/png', name: 'fixture', size: 1, width: 1, height: 1},
    thumbnail: {ext: '.png', url: '/uploads/fixture.png', hash: 'fixture', mime: 'image/png', name: 'fixture', size: 1, width: 1, height: 1},
  },
};

const discography = {title: 'Fixture', release: '2024-01-01', artwork} as unknown as Discography;

describe('Known defects: executable requirement debt', () => {
  it('blog request failures release the loading state', async () => {
    const loading = {loading: true} as unknown as LoadingService;
    const error = new HttpErrorResponse({status: 503, error: {message: 'fixture failure'}});
    const http = {
      get: (url: string) => url.endsWith('/count') ? of(0) : throwError(() => error),
    } as unknown as HttpClient;
    const observedErrors = await runWithExpectedRxjsErrors([error], async () => {
      new IndexComponent(http, title, navigate, loading).ngOnInit();
      await flushUnhandledErrors();
    });

    expect(observedErrors).toEqual([error]);
    expect(loading.loading).toBe(false);
  });

  it('an older blog page response cannot overwrite a newer response', () => {
    const loading = {loading: false} as unknown as LoadingService;
    const responses: Subject<Blog[]>[] = [];
    const http = {
      get: () => {
        const response = new Subject<Blog[]>();
        responses.push(response);
        return response;
      },
    } as unknown as HttpClient;
    const component = new IndexComponent(http, title, navigate, loading);
    component.loadPage(1);
    component.loadPage(2);
    responses[1]!.next([blog(2)]);
    responses[0]!.next([blog(1)]);

    expect(component.blogs()).toEqual([blog(2)]);
  });

  it('reloads an article when the route parameter changes', () => {
    const params = new BehaviorSubject(convertToParamMap({id: 'first'}));
    const responses: Subject<Blog>[] = [];
    const route = {snapshot: {paramMap: convertToParamMap({id: 'first'})}, paramMap: params.asObservable()} as unknown as ActivatedRoute;
    const http = {
      get: () => {
        const response = new Subject<Blog>();
        responses.push(response);
        return response;
      },
    } as unknown as HttpClient;
    const loading = {loading: true} as unknown as LoadingService;
    const component = new ArticleComponent(route, http, title, navigate, loading);
    component.ngOnInit();
    responses[0]!.next(blog(1));
    params.next(convertToParamMap({id: 'second'}));

    if (responses.length === 2) responses[1]!.next(blog(2));
    expect(component.blog()).toEqual(blog(2));
    expect(responses).toHaveLength(2);
  });

  it('releases article loading after a handled 404 redirect', async () => {
    const loading = {loading: true} as unknown as LoadingService;
    const navigations: string[] = [];
    const localNavigate = {go: (path: string) => navigations.push(path)} as unknown as NavigateService;
    const route = {snapshot: {paramMap: convertToParamMap({id: 'missing'})}} as unknown as ActivatedRoute;
    const expectedError = new HttpErrorResponse({status: 404, error: {message: 'missing'}});
    const localHttp = {get: () => throwError(() => expectedError)} as unknown as HttpClient;
    const observedErrors = await runWithExpectedRxjsErrors([expectedError.error], async () => {
      new ArticleComponent(route, localHttp, title, localNavigate, loading).ngOnInit();
      await flushUnhandledErrors();
    });

    expect(observedErrors).toEqual([expectedError.error]);
    expect(navigations).toEqual(['/404']);
    expect(loading.loading).toBe(false);
  });

  it('keeps a replacement notification visible for its complete lifetime', () => {
    vi.useFakeTimers();
    try {
      const service = new NotificationService();
      service.show('first');
      vi.advanceTimersByTime(2_999);
      service.show('second');
      vi.advanceTimersByTime(1);

      expect(service.showNotification).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles loading when the discography response is empty', () => {
    const loading = {loading: true} as unknown as LoadingService;
    const http = {get: () => of([])} as unknown as HttpClient;
    const component = new DiscographyComponent(http, title, loading, navigate);
    component.ngOnInit();

    expect(loading.loading).toBe(false);
  });

  it('settles loading when a discography image fails', async () => {
    const rendered = await render(DiscographyComponent, {
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const loading = TestBed.inject(LoadingService);
    http.expectOne(`${environment.cmsUrl}/discographies`).flush([discography]);
    await rendered.fixture.whenStable();
    rendered.fixture.detectChanges();
    const image = await rendered.findByRole('img', {name: 'fixture'});
    image.dispatchEvent(new Event('error'));

    expect(loading.loading).toBe(false);
  });

  it('does not trust unsafe HTML content as safe content', () => {
    const pipe = new SanitizeHtmlPipe(TestBed.inject(DomSanitizer));
    const result = pipe.transform('<p>fixture</p><script>unsafe()</script>');

    expect(String(result)).not.toContain('<script>');
  });
});
