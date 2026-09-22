import {TestBed} from '@angular/core/testing';
import {Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, NavigationCancellationCode} from '@angular/router';
import type {Event} from '@angular/router';
import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {LoadingService} from './loading.service';
import {NavigateService} from './navigate.service';

describe('Delayed loading feedback', () => {
  let loading: LoadingService;
  let events: Subject<Event>;
  const navigate = vi.fn<Router['navigate']>();
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    events = new Subject<Event>();
    navigate.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({providers: [{provide: Router, useValue: {events, url: '/', navigate}}]});
    loading = TestBed.inject(LoadingService);
    loading.loading = true;
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});

  it('Given the loading feedback service receives content and router transitions when content or router work changes Then keeps explicit short content work invisible without changing pending truth', () => {
    expect(loading.loading).toBe(true);
    expect(loading).toHaveProperty('feedbackVisible', false);
    vi.advanceTimersByTime(199);
    loading.loading = false;
    vi.advanceTimersByTime(1_000);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then settles pending immediately but retains a just-shown interstitial for a gentle exit', () => {
    vi.advanceTimersByTime(201);
    expect(loading).toHaveProperty('feedbackVisible', true);
    loading.loading = false;
    expect(loading.loading).toBe(false);
    expect(loading).toHaveProperty('feedbackVisible', true);
    expect(loading).toHaveProperty('feedbackExiting', false);
    vi.advanceTimersByTime(239);
    expect(loading).toHaveProperty('feedbackExiting', true);
    vi.advanceTimersByTime(179);
    expect(loading).toHaveProperty('feedbackVisible', true);
    vi.advanceTimersByTime(1);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then keeps long work visibly pending and cancels an old exit when new work begins', () => {
    vi.advanceTimersByTime(5_000);
    expect(loading).toHaveProperty('feedbackVisible', true);
    loading.loading = false;
    expect(loading).toHaveProperty('feedbackExiting', true);
    vi.advanceTimersByTime(179);
    const release = loading.beginContentLoad();
    expect(loading).toHaveProperty('feedbackExiting', false);
    vi.advanceTimersByTime(1_000);
    expect(loading.loading).toBe(true);
    expect(loading).toHaveProperty('feedbackVisible', true);
    release();
    vi.advanceTimersByTime(180);
    expect(loading).toHaveProperty('feedbackVisible', false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then does not postpone feedback on repeated true and cancels a completed generation', () => {
    vi.advanceTimersByTime(100);
    loading.loading = true;
    vi.advanceTimersByTime(100);
    expect(loading).toHaveProperty('feedbackVisible', true);
    loading.loading = false;
    loading.loading = true;
    vi.advanceTimersByTime(199);
    expect(loading).toHaveProperty('feedbackVisible', true);
    loading.loading = false;
    vi.advanceTimersByTime(1_000);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then starts feedback for native router navigation and releases cancellation/error', () => {
    loading.loading = false;
    events.next(new NavigationStart(1, '/about'));
    expect(loading.loading).toBe(true);
    events.next(new NavigationCancel(1, '/about', 'guard', NavigationCancellationCode.GuardRejected));
    expect(loading.loading).toBe(false);
    events.next(new NavigationStart(2, '/blog'));
    vi.advanceTimersByTime(200);
    expect(loading).toHaveProperty('feedbackVisible', true);
    events.next(new NavigationError(2, '/blog', new Error('synthetic failed navigation')));
    expect(loading.loading).toBe(false);
    vi.advanceTimersByTime(420);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then ignores a superseded navigation cancellation after the newer start', () => {
    events.next(new NavigationStart(1, '/about'));
    events.next(new NavigationStart(2, '/blog'));
    events.next(new NavigationCancel(1, '/about', 'superseded', NavigationCancellationCode.SupersededByNewNavigation));
    expect(loading.loading).toBe(true);
    vi.advanceTimersByTime(200);
    expect(loading).toHaveProperty('feedbackVisible', true);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then settles route-only work without clearing independently pending page content', () => {
    loading.loading = false;
    events.next(new NavigationStart(4, '/blog?page=2'));
    events.next(new NavigationEnd(4, '/blog?page=2', '/blog?page=2'));
    vi.advanceTimersByTime(500);
    expect(loading.loading).toBe(false);
    expect(loading).toHaveProperty('feedbackVisible', false);
    events.next(new NavigationStart(5, '/about'));
    loading.loading = true;
    events.next(new NavigationEnd(5, '/about', '/about'));
    vi.advanceTimersByTime(200);
    expect(loading.loading).toBe(true);
    expect(loading).toHaveProperty('feedbackVisible', true);
    loading.loading = false;
    vi.advanceTimersByTime(420);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then contains a rejected navigation promise after the Router emits its error', async () => {
    loading.loading = false;
    navigate.mockRejectedValueOnce(new Error('synthetic route failure'));
    const result = TestBed.inject(NavigateService).go('/about');
    events.next(new NavigationStart(6, '/about'));
    events.next(new NavigationError(6, '/about', new Error('synthetic route failure')));
    expect(await result).toBe(false);
    vi.advanceTimersByTime(500);
    expect(loading.loading).toBe(false);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then releases timers and event subscription when the service owner is destroyed', () => {
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
    events.next(new NavigationStart(3, '/blog'));
    vi.advanceTimersByTime(1_000);
    expect(loading).toHaveProperty('feedbackVisible', false);
  });
  for (const elapsedInMs of [200, 5_000]) {
    it(`cleans up a shown interstitial and its timers on destroy at ${elapsedInMs}ms`, () => {
      vi.advanceTimersByTime(elapsedInMs);
      loading.loading = false;
      expect(loading.feedbackVisible).toBe(true);
      TestBed.resetTestingModule();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1_000);
      expect(loading.feedbackVisible).toBe(false);
      expect(loading.feedbackExiting).toBe(false);
    });
  }
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then does not let a stale content release terminate a newer owner or its presentation', () => {
    const staleRelease = loading.beginContentLoad();
    vi.advanceTimersByTime(200);
    const release = loading.beginContentLoad();
    staleRelease();
    vi.advanceTimersByTime(1_000);
    expect(loading.loading).toBe(true);
    expect(loading.feedbackVisible).toBe(true);
    release();
    expect(loading.loading).toBe(false);
    vi.advanceTimersByTime(180);
    expect(loading.feedbackVisible).toBe(false);
  });
  it('Given the loading feedback service receives content and router transitions when content or router work changes Then navigates immediately, rather than enqueueing a 300ms transition', async () => {
    const service = TestBed.inject(NavigateService);
    service.go('/about');
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/about']);
    service.go('/');
    expect(navigate).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});
