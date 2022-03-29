import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscographyComponent } from './discography.component';

describe('DiscographyComponent', () => {
  let component: DiscographyComponent;
  let fixture: ComponentFixture<DiscographyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DiscographyComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DiscographyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
