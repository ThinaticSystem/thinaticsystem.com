import {NotificationService} from './notification.service';
describe('NotificationService regression witnesses', () => {
  it('ignores late notification updates after teardown', () => {
    const service = new NotificationService();
    service.show('first');
    service.show('second');
    expect(service.showNotification).toBe(true);
    expect(service.message).toBe('second');
    service.ngOnDestroy();
    service.show('late update');
    expect(service.showNotification).toBe(false);
  });
});
