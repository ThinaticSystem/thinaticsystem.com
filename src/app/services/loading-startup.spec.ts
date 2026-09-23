import {TestBed} from '@angular/core/testing';
import {NavigationCancel, NavigationError, NavigationStart, Router} from '@angular/router';
import type {Event} from '@angular/router';
import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {LoadingService} from './loading.service';

describe('Given initial navigation has no content owner', () => {
  beforeEach(() => vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']}));
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});
  it.each(['NavigationError', 'NavigationCancel'])('When initial %s navigation completes Then it releases before any page exists', (terminalName) => {
    const terminal = terminalName === 'NavigationError'
      ? new NavigationError(1, '/about', new Error('synthetic bootstrap failure'))
      : new NavigationCancel(1, '/about', 'guard rejected');
    const events = new Subject<Event>();
    TestBed.configureTestingModule({providers: [{provide: Router, useValue: {events}}]});
    const loading = TestBed.inject(LoadingService);
    events.next(new NavigationStart(1, '/about'));
    events.next(terminal);
    vi.advanceTimersByTime(200);
    expect(loading.loading).toBe(false);
    expect(loading.feedbackVisible).toBe(false);
  });
});
