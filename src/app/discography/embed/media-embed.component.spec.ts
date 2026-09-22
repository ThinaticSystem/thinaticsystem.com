import {render, screen} from '@testing-library/angular';
import {vi} from 'vitest';
import {MediaEmbedComponent} from './media-embed.component';

const youtube = '<iframe src="https://www.youtube.com/embed/EDfYEwWGhlg" width="560" height="315"></iframe>';

let currentWidth = 375;
const observers = new Set<TestResizeObserver>();
class TestResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback;
  #target: Element | null = null;
  constructor(callback: ResizeObserverCallback) { this.#callback = callback; }
  observe(target: Element): void { this.#target = target; observers.add(this); this.deliver(currentWidth); }
  unobserve(target: Element): void { if (this.#target === target) this.disconnect(); }
  disconnect(): void { this.#target = null; observers.delete(this); }
  deliver(width: number): void {
    if (!this.#target) return;
    this.#callback([{target: this.#target, contentRect: new DOMRectReadOnly(0, 0, width, 0), borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: []}], this);
  }
}

describe('MediaEmbedComponent', () => {
  beforeEach(() => { currentWidth = 375; observers.clear(); vi.stubGlobal('ResizeObserver', TestResizeObserver); });
  afterEach(() => vi.unstubAllGlobals());
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then [EMBED-R2] uses an explicit safe link below minimum width and removes a player when narrowed', async () => {
    currentWidth = 199;
    const rendered = await render(MediaEmbedComponent, {componentInputs: {html: youtube}});
    expect(screen.queryByTitle('YouTubeで試聴')).toBeNull();
    expect(screen.getByRole('link', {name: 'YouTubeで開く'}).getAttribute('href')).toBe('https://www.youtube.com/watch?v=EDfYEwWGhlg');
    for (const observer of observers) observer.deliver(200);
    rendered.fixture.detectChanges();
    expect(screen.queryByRole('link', {name: 'YouTubeで開く'})).toBeNull();
    const frame = screen.getByTitle('YouTubeで試聴');
    for (const observer of observers) observer.deliver(199);
    rendered.fixture.detectChanges();
    expect(frame.isConnected).toBe(false);
    expect(screen.queryByTitle('YouTubeで試聴')).toBeNull();
    expect(screen.getByRole('link', {name: 'YouTubeで開く'}).getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then disconnects the owned resize observer when destroyed', async () => {
    const rendered = await render(MediaEmbedComponent, {componentInputs: {html: youtube}});
    expect(observers.size).toBe(1);
    rendered.fixture.destroy();
    expect(observers.size).toBe(0);
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then [EMBED-TITLE-1] distinguishes different SoundCloud and YouTube media sharing the supplied Track title', async () => {
    await render(`
      <app-media-embed [html]="soundcloud" [title]="'Track'" />
      <app-media-embed [html]="youtube" [title]="'Track'" />
    `, {imports: [MediaEmbedComponent], componentProperties: {
      soundcloud: '<iframe src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/911614594"></iframe>',
      youtube,
    }});
    const frames = screen.getAllByTitle(/Track/);
    expect(frames).toHaveLength(2);
    expect(frames.every(frame => frame instanceof HTMLIFrameElement)).toBe(true);
    expect(frames.map(frame => frame.getAttribute('title'))).toEqual(['Track — SoundCloud', 'Track — YouTube']);
    expect(new Set(frames.map(frame => frame.getAttribute('src'))).size).toBe(2);
  });
  it.each([
    {provider: 'SoundCloud', html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/911614594"></iframe>'},
    {provider: 'Spotify', html: '<iframe src="https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6?utm_source=generator"></iframe>'},
    {provider: 'YouTube', html: youtube},
  ])('[EMBED-TITLE-2] qualifies supplied $provider titles and retains empty and null fallbacks', async ({provider, html}) => {
    const rendered = await render(MediaEmbedComponent, {componentInputs: {html, title: 'Track'}});
    const frame = screen.getByTitle(/Track/);
    expect(frame).toBeInstanceOf(HTMLIFrameElement);
    expect(frame.getAttribute('title')).toBe(`Track — ${provider}`);
    for (const title of ['', null]) {
      rendered.fixture.componentRef.setInput('title', title);
      rendered.fixture.detectChanges();
      expect(screen.getByTitle(`${provider}で試聴`)).toBe(frame);
    }
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then owns the iframe security attributes rather than copying CMS markup', async () => {
    await render(MediaEmbedComponent, {componentInputs: {html: youtube.replace('width="560"', 'allow="camera; microphone" sandbox="allow-top-navigation" style="position:fixed" width="560"'), title: '楽曲の試聴'}});
    const frame = screen.getByTitle('楽曲の試聴 — YouTube');
    expect(frame.getAttribute('src')).toBe('https://www.youtube.com/embed/EDfYEwWGhlg');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(frame.getAttribute('allow')).toBe('autoplay; encrypted-media; fullscreen; picture-in-picture');
    expect(frame.getAttribute('style')).toBeNull();
    expect(frame.getAttribute('srcdoc')).toBeNull();
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame.getAttribute('loading')).toBe('lazy');
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then replaces an approved player with a blocked message without retaining its old URL', async () => {
    const rendered = await render(MediaEmbedComponent, {componentInputs: {html: youtube}});
    expect(screen.getByTitle('YouTubeで試聴')).toBeTruthy();
    rendered.fixture.componentRef.setInput('html', '<iframe src="https://evil.test/"></iframe>');
    rendered.fixture.detectChanges();
    expect(screen.queryByTitle('YouTubeで試聴')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('表示できません');
    rendered.fixture.componentRef.setInput('html', null);
    rendered.fixture.detectChanges();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then escapes the visible title and does not turn it into markup', async () => {
    await render(MediaEmbedComponent, {componentInputs: {html: youtube, title: '<img onerror="unsafe()">'}});
    expect(screen.getByTitle('<img onerror="unsafe()"> — YouTube').getAttribute('title')).toBe('<img onerror="unsafe()"> — YouTube');
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('Given a media embed receives provider and viewport changes when viewport or provider state changes Then changes provider with its own fixed sandbox and permission policy', async () => {
    const rendered = await render(MediaEmbedComponent, {componentInputs: {html: youtube}});
    rendered.fixture.componentRef.setInput('html', '<iframe src="https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6?utm_source=generator"></iframe>');
    rendered.fixture.detectChanges();
    expect(screen.queryByTitle('YouTubeで試聴')).toBeNull();
    const spotify = screen.getByTitle('Spotifyで試聴');
    expect(spotify.getAttribute('allow')).toBe('autoplay; encrypted-media');
    expect(spotify.getAttribute('height')).toBe('80');
    rendered.fixture.componentRef.setInput('html', '<iframe src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/911614594"></iframe>');
    rendered.fixture.detectChanges();
    const soundcloud = screen.getByTitle('SoundCloudで試聴');
    expect(soundcloud.getAttribute('allow')).toBe('autoplay');
    expect(soundcloud.getAttribute('height')).toBe('166');
    expect(screen.queryByTitle('Spotifyで試聴')).toBeNull();
  });
});
