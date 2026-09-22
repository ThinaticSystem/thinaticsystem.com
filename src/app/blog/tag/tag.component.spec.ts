import { ComponentFixture, TestBed } from '@angular/core/testing';
import TagComponent from './tag.component';

describe('IndexComponent', () => {
  let component: TagComponent;
  let fixture: ComponentFixture<TagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('When the owner is created Then it is available', () => {
    expect(component).toBeTruthy();
  });
});
