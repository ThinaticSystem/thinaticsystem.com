import {TestBed} from '@angular/core/testing';

import {LoadingService} from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publishes changes through a signal-backed property for zoneless templates', () => {
    // NOTE: Startup has no fictitious content owner; route/page work explicitly starts pending.
    expect(service.loading).toBe(false);
    service.loading = true;
    expect(service.loading).toBe(true);
    service.loading = false;
    expect(service.loading).toBe(false);
  });
});
