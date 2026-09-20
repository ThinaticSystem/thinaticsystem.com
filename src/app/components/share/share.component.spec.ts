import {ComponentFixture, TestBed} from '@angular/core/testing';
import {screen} from '@testing-library/angular';
import {ClipboardService} from 'ngx-clipboard';
import {vi} from 'vitest';

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

  it('[social-share-reserved] preserves each query value through one URL decoding', () => {
    const share = {text: 'A&B #C++ ?日本% /', url: 'https://example.test/a%2Fb?q=A+B&next=%23x#section'};
    fixture.componentRef.setInput('share', share);
    fixture.detectChanges();
    const url = new URL(screen.getByRole('link', {name: 'Twitterでこのページを共有します'}).getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe(share.text + '\n');
    expect(url.searchParams.get('url')).toBe(share.url);
    expect([...url.searchParams.keys()]).toEqual(['text', 'url']);
    expect(url.hash).toBe('');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps named native share controls and the external destination', () => {
    expect(screen.getByRole('heading', {name: 'Share', level: 2})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'このページのURLをコピーします'})).toBeInstanceOf(HTMLButtonElement);
    const link = screen.getByRole('link', {name: 'Twitterでこのページを共有します'});
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://twitter.com/intent/tweet');
    expect(url.searchParams.get('text')).toBe('Share this page\n');
    expect(url.searchParams.get('url')).toBe('https://example.test/article');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('copies the current input through the directive and only announces success', () => {
    const clipboard = TestBed.inject(ClipboardService);
    vi.spyOn(clipboard, 'isSupported', 'get').mockReturnValue(true);
    const copy = vi.spyOn(clipboard, 'copyFromContent').mockReturnValue(false);
    const notify = vi.spyOn(component.Notification, 'show').mockImplementation(() => {});
    const button = screen.getByRole('button', {name: 'このページのURLをコピーします'});
    try {
      button.click();
      expect(copy).toHaveBeenLastCalledWith('Share this page\nhttps://example.test/article', undefined);
      expect(notify).not.toHaveBeenCalled();
      fixture.componentRef.setInput('share', {text: 'New title', url: 'https://example.test/new', copyMsg: 'Copied new page'});
      fixture.detectChanges();
      copy.mockReturnValue(true);
      button.click();
      expect(copy).toHaveBeenLastCalledWith('New title\nhttps://example.test/new', undefined);
      expect(notify).toHaveBeenCalledExactlyOnceWith('Copied new page');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('does not report a rejected copy as a successful copy', () => {
    fixture.nativeElement.querySelector('button').dispatchEvent(new Event('cbOnError'));

    expect(component.Notification.showNotification).toBe(false);
  });


});
