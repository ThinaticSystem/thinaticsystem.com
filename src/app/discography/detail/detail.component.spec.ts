import { ComponentFixture, TestBed } from '@angular/core/testing';
import DetailComponent from './detail.component';

describe('Given the discography detail page owner is created', () => {
  let component: DetailComponent;
  let fixture: ComponentFixture<DetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then the discography detail component is available', () => {
    expect(component).toBeTruthy();
  });
});
