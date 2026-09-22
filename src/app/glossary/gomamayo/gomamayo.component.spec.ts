import { ComponentFixture, TestBed } from '@angular/core/testing';
import GomamayoComponent from './gomamayo.component';

describe('GomamayoComponent Given the owner is initialized', () => {
  let component: GomamayoComponent;
  let fixture: ComponentFixture<GomamayoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GomamayoComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GomamayoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then it is available', () => {
    expect(component).toBeTruthy();
  });
});
