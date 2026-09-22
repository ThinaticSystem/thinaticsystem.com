import {admitPlayerUrl} from './embed-policy';
import {readEmbedHtml} from './embed-html';
import {observedEmbeds} from '../../../../test/fixtures/observed-media-embeds';

const youtube = 'https://www.youtube.com/embed/EDfYEwWGhlg';
const soundcloud = 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F911614594';

describe('Given the embed policy receives CMS media metadata', () => {
  it.each(observedEmbeds.filter(item => item.html !== null))('preserves observed release $releaseId demo $demoId as a canonical provider player', ({html}) => {
    const admitted = readEmbedHtml(html, document);
    expect(admitted.type).toBe('media');
    if (admitted.type !== 'media' || typeof html !== 'string') throw new Error('Expected an observed player');
    const expectedSource = html.match(/\bsrc="([^"]+)"/)?.[1];
    expect(expectedSource).toBeTruthy();
    const expected = new URL(expectedSource!);
    const actual = new URL(admitted.media.src);
    expect(actual.hostname).toBe(expected.hostname);
    expect(actual.pathname).toBe(expected.pathname);
    if (expected.hostname === 'w.soundcloud.com') {
      expect(actual.searchParams.get('url')).toBe(expected.searchParams.get('url'));
      expect(actual.searchParams.get('visual')).toBe(expected.searchParams.get('visual'));
      expect(admitted.media.height).toBe(expected.searchParams.get('visual') === 'true' ? 300 : 166);
    }
  });
  it('When admits the observed complete corpus without inventing a player for null', () => {
    expect(observedEmbeds).toHaveLength(21);
    const admitted = observedEmbeds.map(item => readEmbedHtml(item.html, document));
    expect(admitted.filter(item => item.type === 'media')).toHaveLength(20);
    expect(admitted.filter(item => item.type === 'empty')).toHaveLength(1);
  });
  it.each([
    'http://www.youtube.com/embed/EDfYEwWGhlg',
    'javascript:alert(1)', 'data:text/html,unsafe', '/embed/EDfYEwWGhlg',
    'https://www.youtube.com.evil.test/embed/EDfYEwWGhlg',
    'https://www.youtube.com@evil.test/embed/EDfYEwWGhlg',
    'https://evil@www.youtube.com/embed/EDfYEwWGhlg',
    'https://www.youtube.com:8443/embed/EDfYEwWGhlg',
    'https://www.youtube.com\\@evil.test/embed/EDfYEwWGhlg',
    youtube + '#fragment', youtube + '?autoplay=1', youtube + '?redirect=https://evil.test',
    'https://www.youtube.com/watch?v=EDfYEwWGhlg',
    'https://www.youtube.com/embed/short',
    'https://www.youtube.com/embed/EDfYEwWGhlg/extra',
    'https://open.spotify.com/embed/track/short',
    'https://open.spotify.com/embed/album/5OkcBpFUdMIVYpjc88RMC6',
    'https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6?utm_source=x&utm_source=y',
    'https://w.soundcloud.com/player/?url=https%3A%2F%2Fevil.test%2Ftracks%2F123',
    'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com.evil.test%2Ftracks%2F123',
    'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F123',
    soundcloud + '&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F2',
    soundcloud + '&auto_play=true', soundcloud + '&color=red', soundcloud + '&visual=1',
    soundcloud + '%0A', soundcloud + '&color=%23ABCDEF%0A',
    soundcloud + '&unknown=true', youtube + '\n', youtube + '\u0000', 'x'.repeat(4_097),
  ])('rejects unsupported player URL %s', value => {
    expect(admitPlayerUrl(value)).toBeNull();
  });
  it('When retains safe SoundCloud appearance but fixes autoplay off', () => {
    const admitted = admitPlayerUrl(soundcloud + '&visual=true&color=%23ABCDEF&show_comments=false');
    expect(admitted?.height).toBe(300);
    const url = new URL(admitted!.src);
    expect(url.searchParams.get('url')).toBe('https://api.soundcloud.com/tracks/911614594');
    expect(url.searchParams.get('auto_play')).toBe('false');
    expect(url.searchParams.get('color')).toBe('#abcdef');
    expect(url.searchParams.get('show_comments')).toBe('false');
    expect(admitPlayerUrl(soundcloud)?.height).toBe(166);
  });
  it('When preserves nocookie choice and removes Spotify tracking parameters', () => {
    const nocookie = youtube.replace('www.youtube.com', 'www.youtube-nocookie.com');
    expect(admitPlayerUrl(nocookie)?.src).toBe(nocookie);
    expect(admitPlayerUrl('https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6?utm_source=generator')).toEqual({provider: 'spotify', height: 80, src: 'https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6'});
  });
  it.each([
    `<script>unsafe()</script><iframe src="${youtube}"></iframe>`,
    `<img src="https://evil.test/probe"><iframe src="${youtube}"></iframe>`,
    `<iframe src="${youtube}" onload="unsafe()"></iframe>`,
    `<iframe src="${youtube}" srcdoc="<script>unsafe()</script>"></iframe>`,
    `<svg><iframe src="${youtube}"></iframe></svg>`,
    `<template><iframe src="${youtube}"></iframe></template>`,
    `<p>arbitrary wrapper<iframe src="${youtube}"></iframe></p>`,
    `<iframe src="${youtube}"></iframe><iframe src="${youtube}"></iframe>`,
    '<iframe></iframe>', '<iframe src="https://player.example.test/embed/1"></iframe>',
    '<iframe src="javascript:unsafe()"></iframe>', '<!-- iframe -->',
    '<object data="https://evil.test"></object>', 'x'.repeat(16_385), 123, {},
  ])('blocks arbitrary HTML instead of mounting it: %s', value => {
    expect(readEmbedHtml(value, document).type).toBe('blocked');
  });
  it.each([null, undefined, '', ' \n '])('does not invent content from an empty record %s', value => {
    expect(readEmbedHtml(value, document)).toEqual({type: 'empty'});
  });
  it('When does not forward CMS attributes or styles in the admitted model', () => {
    expect(readEmbedHtml(`<iframe src="${youtube}" style="position:fixed;inset:0" allow="camera;microphone" sandbox="allow-top-navigation" title="untrusted" class="fixed"></iframe>`, document)).toEqual({type: 'media', media: {provider: 'youtube', src: youtube, height: null, watchUrl: 'https://www.youtube.com/watch?v=EDfYEwWGhlg'}});
  });
});
