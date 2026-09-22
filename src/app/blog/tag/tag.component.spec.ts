import { ComponentFixture, TestBed } from '@angular/core/testing';
import TagComponent from './tag.component';

describe('Given the blog tag page owner is created', () => {
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

  it('When the owner is created Then the blog tag page component is available', () => {
    expect(component).toBeTruthy();
  });
});
