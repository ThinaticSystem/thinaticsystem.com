import { ComponentFixture, TestBed } from '@angular/core/testing';
import GomamayoComponent from './gomamayo.component';

describe('Given the Gomamayo glossary page owner is created', () => {
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

  it('When the owner is created Then the Gomamayo glossary component is available', () => {
    expect(component).toBeTruthy();
  });
});
