import { ComponentFixture, TestBed } from '@angular/core/testing';
import AboutComponent from './about.component';

describe('Given the about page owner is created', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then the about page component is available', () => {
    expect(component).toBeTruthy();
  });
});
