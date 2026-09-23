import {TestBed} from '@angular/core/testing';

import {NavigateService} from './navigate.service';

describe('Given the navigation service is injected', () => {
  let service: NavigateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NavigateService);
  });

  it('Given the navigation service is injected When the owner is created Then it is available', () => {
    expect(service).toBeTruthy();
  });
});
