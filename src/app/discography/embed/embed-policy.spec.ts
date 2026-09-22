import {admitPlayerUrl} from './embed-policy';
import {readEmbedHtml} from './embed-html';
import {observedEmbeds} from '../../../../test/fixtures/observed-media-embeds';

const youtube = 'https://www.youtube.com/embed/EDfYEwWGhlg';
const soundcloud = 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F911614594';

describe('Given the embed policy receives CMS media metadata', () => {
  it.each(observedEmbeds.filter(item => item.html !== null))('When release $releaseId demo $demoId provides observed HTML Then it returns a media player', ({html, expectedType}) => {
    const admitted = readEmbedHtml(html, document);
    expect(admitted.type).toBe(expectedType);
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
    {scenario: 'HTTP YouTube URL', value: 'http://www.youtube.com/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'JavaScript URL', value: 'javascript:alert(1)', expected: null},
    {scenario: 'data URL', value: 'data:text/html,unsafe', expected: null},
    {scenario: 'relative embed path', value: '/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'evil YouTube hostname', value: 'https://www.youtube.com.evil.test/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'evil URL userinfo', value: 'https://***@evil.test/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'YouTube userinfo', value: 'https://evil@www.youtube.com/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'nonstandard YouTube port', value: 'https://www.youtube.com:8443/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'duplicate evil userinfo URL', value: 'https://***@evil.test/embed/EDfYEwWGhlg', expected: null},
    {scenario: 'YouTube fragment', value: youtube + '#fragment', expected: null},
    {scenario: 'YouTube autoplay query', value: youtube + '?autoplay=1', expected: null},
    {scenario: 'YouTube redirect query', value: youtube + '?redirect=https://evil.test', expected: null},
    {scenario: 'YouTube watch route', value: 'https://www.youtube.com/watch?v=EDfYEwWGhlg', expected: null},
    {scenario: 'short YouTube video ID', value: 'https://www.youtube.com/embed/short', expected: null},
    {scenario: 'extra YouTube path', value: 'https://www.youtube.com/embed/EDfYEwWGhlg/extra', expected: null},
    {scenario: 'short Spotify track ID', value: 'https://open.spotify.com/embed/track/short', expected: null},
    {scenario: 'Spotify album route', value: 'https://open.spotify.com/embed/album/5OkcBpFUdMIVYpjc88RMC6', expected: null},
    {scenario: 'duplicate Spotify query', value: 'https://open.spotify.com/embed/track/5OkcBpFUdMIVYpjc88RMC6?utm_source=x&utm_source=y', expected: null},
    {scenario: 'evil SoundCloud track URL', value: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fevil.test%2Ftracks%2F123', expected: null},
    {scenario: 'evil SoundCloud hostname', value: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com.evil.test%2Ftracks%2F123', expected: null},
    {scenario: 'SoundCloud playlist route', value: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F123', expected: null},
    {scenario: 'duplicate SoundCloud URL parameter', value: soundcloud + '&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F2', expected: null},
    {scenario: 'SoundCloud autoplay option', value: soundcloud + '&auto_play=true', expected: null},
    {scenario: 'SoundCloud color option', value: soundcloud + '&color=red', expected: null},
    {scenario: 'SoundCloud visual option', value: soundcloud + '&visual=1', expected: null},
    {scenario: 'encoded newline', value: soundcloud + '%0A', expected: null},
    {scenario: 'encoded color newline', value: soundcloud + '&color=%23ABCDEF%0A', expected: null},
    {scenario: 'unknown SoundCloud option', value: soundcloud + '&unknown=true', expected: null},
    {scenario: 'trailing newline', value: youtube + '\n', expected: null},
    {scenario: 'NUL character', value: youtube + '\u0000', expected: null},
    {scenario: '4,097-character URL', value: 'x'.repeat(4_097), expected: null},
  ])('When the policy receives $scenario Then it returns null', ({value, expected}) => {
    expect(admitPlayerUrl(value)).toBe(expected);
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
    {scenario: 'script-wrapped iframe HTML', value: `<script>unsafe()</script><iframe src="${youtube}"></iframe>`, expectedType: 'blocked'},
    {scenario: 'image plus iframe HTML', value: `<img src="https://evil.test/probe"><iframe src="${youtube}"></iframe>`, expectedType: 'blocked'},
    {scenario: 'iframe with onload HTML', value: `<iframe src="${youtube}" onload="unsafe()"></iframe>`, expectedType: 'blocked'},
    {scenario: 'iframe with srcdoc HTML', value: `<iframe src="${youtube}" srcdoc="<script>unsafe()</script>"></iframe>`, expectedType: 'blocked'},
    {scenario: 'SVG-wrapped iframe HTML', value: `<svg><iframe src="${youtube}"></iframe></svg>`, expectedType: 'blocked'},
    {scenario: 'template-wrapped iframe HTML', value: `<template><iframe src="${youtube}"></iframe></template>`, expectedType: 'blocked'},
    {scenario: 'arbitrary paragraph wrapper HTML', value: `<p>arbitrary wrapper<iframe src="${youtube}"></iframe></p>`, expectedType: 'blocked'},
    {scenario: 'two iframe HTML', value: `<iframe src="${youtube}"></iframe><iframe src="${youtube}"></iframe>`, expectedType: 'blocked'},
    {scenario: 'iframe without src HTML', value: '<iframe></iframe>', expectedType: 'blocked'},
    {scenario: 'unsupported player iframe HTML', value: '<iframe src="https://player.example.test/embed/1"></iframe>', expectedType: 'blocked'},
    {scenario: 'javascript iframe HTML', value: '<iframe src="javascript:unsafe()"></iframe>', expectedType: 'blocked'},
    {scenario: 'iframe comment HTML', value: '<!-- iframe -->', expectedType: 'blocked'},
    {scenario: 'object HTML', value: '<object data="https://evil.test"></object>', expectedType: 'blocked'},
    {scenario: '16,385-character HTML', value: 'x'.repeat(16_385), expectedType: 'blocked'},
    {scenario: 'numeric HTML input', value: 123, expectedType: 'blocked'},
    {scenario: 'object HTML input', value: {}, expectedType: 'blocked'},
  ])('When the policy receives $scenario Then it returns the blocked result', ({value, expectedType}) => {
    expect(readEmbedHtml(value, document).type).toBe(expectedType);
  });
  it.each([
    {scenario: 'null record', value: null, expected: {type: 'empty'}},
    {scenario: 'undefined record', value: undefined, expected: {type: 'empty'}},
    {scenario: 'empty string record', value: '', expected: {type: 'empty'}},
    {scenario: 'whitespace-only record', value: ' \n ', expected: {type: 'empty'}},
  ])('When the policy receives the $scenario Then it returns the empty result', ({value, expected}) => {
    expect(readEmbedHtml(value, document)).toEqual(expected);
  });
  it('When does not forward CMS attributes or styles in the admitted model', () => {
    expect(readEmbedHtml(`<iframe src="${youtube}" style="position:fixed;inset:0" allow="camera;microphone" sandbox="allow-top-navigation" title="untrusted" class="fixed"></iframe>`, document)).toEqual({type: 'media', media: {provider: 'youtube', src: youtube, height: null, watchUrl: 'https://www.youtube.com/watch?v=EDfYEwWGhlg'}});
  });
});
