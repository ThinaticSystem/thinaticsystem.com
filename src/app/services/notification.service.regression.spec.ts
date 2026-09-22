import {vi} from 'vitest';
import {NotificationService} from './notification.service';

describe('NotificationService regression witnesses', () => {
  it('Given a service has been used When teardown completes Then late notification updates are ignored', () => {
    const service = new NotificationService();
    service.show('first');
    service.show('second');
    expect(service.showNotification).toBe(true);
    expect(service.message).toBe('second');
    service.ngOnDestroy();
    service.show('late update');
    expect(service.showNotification).toBe(false);
  });

  describe('Given a timer-backed service', () => {
    let service: NotificationService;

    beforeEach(() => {
      vi.useFakeTimers();
      service = new NotificationService();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('When a replacement arrives near expiry Then each message gets a full three seconds', () => {
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
  });
});
