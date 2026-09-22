import {NotificationService} from './notification.service';
import {vi} from 'vitest';

describe('NotificationService Given a fresh service with fake timers', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new NotificationService();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('When blank and omitted messages replace content Then one timer and the default message remain', () => {
    service.show('first');
    service.show('');
    service.show(undefined);
    expect(service.message).toBe('コピーしました！');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3_000);
    expect(service.showNotification).toBe(false);
  });

  it('When the injector destroys the service Then its timer is released', async () => {
    const {TestBed} = await import('@angular/core/testing');
    TestBed.configureTestingModule({});
    const owned = TestBed.inject(NotificationService);
    owned.show('owned');
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
    expect(owned.showNotification).toBe(false);
  });
});
