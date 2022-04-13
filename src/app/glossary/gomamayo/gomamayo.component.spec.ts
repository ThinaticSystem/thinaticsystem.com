import {ComponentFixture, TestBed} from '@angular/core/testing';

import {GomamayoComponent} from './gomamayo.component';

describe('GomamayoComponent', () => {
  let component: GomamayoComponent;
  let fixture: ComponentFixture<GomamayoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GomamayoComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GomamayoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
