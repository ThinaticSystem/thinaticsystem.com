import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {ClipboardService} from 'ngx-clipboard';
import {vi} from 'vitest';
import {AppComponent} from './app.component';
import HomeComponent from './index/index.component';
import {NotificationService} from './services/notification.service';
import {environment} from '../environments/environment';

describe('Given clipboard feedback starts with no prior success', () => {
  afterEach(() => {TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers();});

  it('Given clipboard feedback starts with no prior success when the component starts or copy feedback changes Then does not mount a toast or dismiss control at cold startup, even during loading', async () => {
    const {fixture} = await render(AppComponent);
    expect(fixture.componentInstance.notification.showNotification).toBe(false);
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    fixture.componentInstance.loadingService.loading = true;
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
    vi.advanceTimersByTime(3_000);
    fixture.detectChanges();
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
  });

  it.each(['{Enter}', ' '])('When the focused home-copy control is activated with %s Then it admits a toast only after a successful copy', async (key) => {
    const {fixture} = await render('<app-root /> <app-index />', {
      imports: [AppComponent, HomeComponent], providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(environment.cmsUrl + '/notifications').flush([]);
    http.expectOne(environment.publicUrl + '/workers/patrons').flush([]);
    http.verify();
    const clipboard = TestBed.inject(ClipboardService);
    vi.spyOn(clipboard, 'isSupported', 'get').mockReturnValue(true);
    // NOTE: JSDOM has no OS clipboard. Exercise the real directive and Home success binding,
    // with the pinned clipboard adapter's boolean result controlled at its native-copy boundary.
    const copy = vi.spyOn(clipboard, 'copyFromContent').mockReturnValue(false);
    const user = userEvent.setup();
    const button = screen.getByRole('button', {name: 'デボビゲゴをクリップボードにコピーします'});
    button.focus();
    await user.keyboard(key);
    fixture.detectChanges();
    expect(copy).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
    copy.mockReturnValue(true);
    await user.keyboard(key);
    fixture.detectChanges();
    expect(copy).toHaveBeenCalledTimes(2);
    expect(copy.mock.calls[1]?.[0]).toContain('#しなちくシステム無料ガチャ');
    expect(screen.getByText('クリップボードにコピーしました！')).toBeTruthy();
    expect(document.activeElement).toBe(button);
    await user.click(screen.getByRole('button', {name: '通知を閉じる'}));
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
  });

  it('Given clipboard feedback starts with no prior success when the component starts or copy feedback changes Then expires success feedback without manual change detection and refreshes its owned timer', async () => {
    const {fixture} = await render(AppComponent);
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const notification = TestBed.inject(NotificationService);
    notification.show('First success');
    fixture.detectChanges();
    vi.advanceTimersByTime(2_900);
    notification.show('Latest success');
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    await fixture.whenStable();
    expect(screen.getByText('Latest success')).toBeTruthy();
    vi.advanceTimersByTime(2_900);
    await fixture.whenStable();
    expect(notification.showNotification).toBe(false);
    expect(screen.queryByRole('button', {name: '通知を閉じる'})).toBeNull();
    notification.show('Disposed success');
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });
});
