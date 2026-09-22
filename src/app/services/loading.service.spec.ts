import {TestBed} from '@angular/core/testing';

import {LoadingService} from './loading.service';

describe('LoadingService Given the owner is initialized', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that should be created', () => {
    expect(service).toBeTruthy();
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that publishes changes through a signal-backed property for zoneless templates', () => {
    // NOTE: Startup has no fictitious content owner; route/page work explicitly starts pending.
    expect(service.loading).toBe(false);
    service.loading = true;
    expect(service.loading).toBe(true);
    service.loading = false;
    expect(service.loading).toBe(false);
  });
});
