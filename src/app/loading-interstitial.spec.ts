import {TestBed} from '@angular/core/testing';
import {render, screen} from '@testing-library/angular';
import {vi} from 'vitest';
import {AppComponent} from './app.component';

describe('Given loading feedback renders in reduced-motion or failed-artwork state', () => {
  afterEach(() => {TestBed.resetTestingModule(); vi.useRealTimers();});

  it('Given loading feedback renders in reduced-motion or failed-artwork state when loading completes or artwork fails Then retains the original GIF with a native static reduced-motion source and removes pending semantics at completion', async () => {
    const {fixture} = await render(AppComponent);
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const loading = fixture.componentInstance.loadingService;
    loading.loading = true;
    vi.advanceTimersByTime(199);
    fixture.detectChanges();
    expect(screen.queryByRole('status')).toBeNull();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('ページを読み込み中');
    // NOTE: Decorative artwork has no user action/role. Inspect its native picture contract;
    // actual currentSrc selection on live media changes belongs to real-browser QA.
    const shell: HTMLElement = fixture.nativeElement;
    const picture = shell.getElementsByTagName('picture')[0];
    if (!picture) throw new Error('Expected decorative loading picture');
    const source = picture.getElementsByTagName('source')[0];
    const image = picture.getElementsByTagName('img')[0];
    if (!source || !image) throw new Error('Expected native source and image');
    expect(source.media).toBe('(prefers-reduced-motion: reduce)');
    expect(source.srcset).toBe('/assets/site_logo.svg');
    expect(image.src).toBe(fixture.componentInstance.enviroment.cmsUrl + '/uploads/loading_2c53045083.gif');
    expect(image.alt).toBe('');
    const theme = screen.getByRole('button', {name: 'ライトモードとダークモードを切り替えます'});
    theme.focus();
    loading.loading = false;
    fixture.detectChanges();
    expect(loading.loading).toBe(false);
    expect(loading.feedbackVisible).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
    expect(image.src).toBe(fixture.componentInstance.enviroment.cmsUrl + '/uploads/loading_2c53045083.gif');
    expect(screen.queryByText('ページを読み込み中…')).toBeNull();
    expect(document.activeElement).toBe(theme);
    vi.advanceTimersByTime(420);
    fixture.detectChanges();
    expect(shell.getElementsByTagName('picture').length).toBe(0);
  });

  it('Given loading feedback renders in reduced-motion or failed-artwork state when loading completes or artwork fails Then keeps a static fallback icon after artwork failure without visible text or false completion', async () => {
    const {fixture} = await render(AppComponent);
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const loading = fixture.componentInstance.loadingService;
    const release = loading.beginContentLoad();
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    const shell: HTMLElement = fixture.nativeElement;
    const picture = shell.getElementsByTagName('picture')[0];
    if (!picture) throw new Error('Expected decorative loading picture');
    const image = picture.getElementsByTagName('img')[0];
    if (!image) throw new Error('Expected loading image');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    const fallback = screen.getByRole('status').getElementsByTagName('svg')[0];
    expect(fallback?.getAttribute('viewBox')).toBe('-2 0 152 81');
    expect(fallback?.getElementsByTagName('path').length).toBe(1);
    expect(shell.getElementsByTagName('picture').length).toBe(0);
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
    expect(screen.queryByText('ページを読み込み中…')).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(loading.loading).toBe(true);
    release();
    fixture.detectChanges();
    expect(screen.queryByRole('status')).toBeNull();
    vi.advanceTimersByTime(180);
    expect(loading.feedbackVisible).toBe(false);
  });
});
