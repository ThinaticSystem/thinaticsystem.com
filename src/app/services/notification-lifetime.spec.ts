import {NotificationService} from './notification.service';
import {vi} from 'vitest';

describe('NotificationService lifetime', () => {
  let service: NotificationService;
  beforeEach(() => {vi.useFakeTimers(); service = new NotificationService();});
  afterEach(() => {vi.clearAllTimers(); vi.useRealTimers();});

  it('[notification-replacement-lifetime] gives each replacement its full three seconds', () => {
    service.show('first');
    vi.advanceTimersByTime(2_999);
    service.show('second');
    vi.advanceTimersByTime(1);
    expect(service.showNotification).toBe(true);
    expect(service.message).toBe('second');
    vi.advanceTimersByTime(2_998);
    expect(service.showNotification).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.showNotification).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('repeated replacements keep one timer and preserve the default message', () => {
    service.show('first');
    service.show('');
    service.show(undefined);
    expect(service.message).toBe('コピーしました！');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3_000);
    expect(service.showNotification).toBe(false);
  });

  it('releases its timer when the injector destroys the service', async () => {
    const {TestBed} = await import('@angular/core/testing');
    TestBed.configureTestingModule({});
    const owned = TestBed.inject(NotificationService);
    owned.show('owned');
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
    expect(owned.showNotification).toBe(false);
  });
});
