import {TestBed} from '@angular/core/testing';

import {NotificationService} from './notification.service';

describe('NotificationService Given the service is injected', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('When the service is created Then it is available', () => {
    expect(service).toBeTruthy();
  });
});
