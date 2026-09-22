import { ComponentFixture, TestBed } from '@angular/core/testing';
import NotfoundComponent from './notfound.component';

describe('Given the not-found page owner is created', () => {
  let component: NotfoundComponent;
  let fixture: ComponentFixture<NotfoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotfoundComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NotfoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then the not-found component is available', () => {
    expect(component).toBeTruthy();
  });
});
