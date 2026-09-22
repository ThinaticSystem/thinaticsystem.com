import {TestBed} from '@angular/core/testing';

import {NavigateService} from './navigate.service';

describe('NavigateService Given the owner is initialized', () => {
  let service: NavigateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NavigateService);
  });

  it('When the recorded scenario is exercised Then the contract demonstrates that should be created', () => {
    expect(service).toBeTruthy();
  });
});
