import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {AppComponent} from './app.component';

describe('AppComponent Given the application shell is rendered', () => {
  it('When the component is created Then it exposes an application instance', async () => {
    const {fixture} = await render(AppComponent);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('When a user toggles theme and menu controls Then semantic state and navigation are exposed', async () => {
    await render(AppComponent);
    const user = userEvent.setup();
    const themeButton = screen.getByRole('button', {
      name: 'ライトモードとダークモードを切り替えます',
    });
    const menuButton = screen.getByRole('button', {name: 'メニューを開きます'});

    expect(screen.getByRole('main')).toBeTruthy();
    expect(themeButton.getAttribute('aria-pressed')).toBe('false');
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');

    await user.click(themeButton);
    await user.click(menuButton);

    expect(themeButton.getAttribute('aria-pressed')).toBe('true');
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation', {name: 'モバイルナビゲーション'})).toBeTruthy();
  });
});
