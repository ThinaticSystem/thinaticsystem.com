import { ComponentFixture, TestBed } from '@angular/core/testing';
import IndexComponent from './index.component';

describe('Given the glossary index page owner is created', () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndexComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then the glossary index component is available', () => {
    expect(component).toBeTruthy();
  });
});
