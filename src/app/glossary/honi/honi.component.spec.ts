import { ComponentFixture, TestBed } from '@angular/core/testing';
import HoniComponent from './honi.component';

describe('Given the Honi glossary page owner is created', () => {
  let component: HoniComponent;
  let fixture: ComponentFixture<HoniComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoniComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HoniComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then the Honi glossary component is available', () => {
    expect(component).toBeTruthy();
  });
});
