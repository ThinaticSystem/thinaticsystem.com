import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ShareComponent} from './share.component';

describe('ShareComponent', () => {
  let component: ShareComponent;
  let fixture: ComponentFixture<ShareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShareComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('share', {
      text: 'Share this page',
      url: 'https://example.test/article',
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not report a rejected copy as a successful copy', () => {
    fixture.nativeElement.querySelector('button').dispatchEvent(new Event('cbOnError'));

    expect(component.Notification.showNotification).toBe(false);
  });


});
