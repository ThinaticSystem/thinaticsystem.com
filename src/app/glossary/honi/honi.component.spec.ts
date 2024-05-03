import { ComponentFixture, TestBed } from '@angular/core/testing';
import HoniComponent from './honi.component';

describe('HoniComponent', () => {
  let component: HoniComponent;
  let fixture: ComponentFixture<HoniComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HoniComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HoniComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
