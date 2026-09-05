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
    expect(service.loading).toBe(true);

    service.loading = false;

    expect(service.loading).toBe(false);
  });
});
