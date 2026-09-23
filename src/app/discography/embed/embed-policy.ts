export type MediaEmbed = Readonly<{
  provider: 'soundcloud' | 'spotify';
  src: string;
  height: number;
}> | Readonly<{
  provider: 'youtube';
  src: string;
  height: null;
  watchUrl: string;
}>;

const soundCloudFlags = ['hide_related', 'show_comments', 'show_user', 'show_reposts', 'show_teaser', 'visual'] as const;

/** Admits only observed player routes; output URLs are rebuilt, not forwarded. */
export function admitPlayerUrl(value: string): MediaEmbed | null {
  if (value.length > 4_096 || /[\s\\]/u.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
  const keys = [...url.searchParams.keys()];
  if (new Set(keys).size !== keys.length) return null;

  if (url.hostname === 'w.soundcloud.com' && url.pathname === '/player/') {
    const allowed: readonly string[] = ['url', 'color', 'auto_play', ...soundCloudFlags];
    if (keys.some(key => !allowed.includes(key))) return null;
    const inner = url.searchParams.get('url');
    const track = /^https:\/\/api\.soundcloud\.com\/tracks\/([0-9]+)$/.exec(inner ?? '');
    if (!track || track[0] !== inner) return null;
    if (url.searchParams.has('auto_play') && url.searchParams.get('auto_play') !== 'false') return null;
    const canonical = new URL('https://w.soundcloud.com/player/');
    canonical.searchParams.set('url', `https://api.soundcloud.com/tracks/${track[1]}`);
    canonical.searchParams.set('auto_play', 'false');
    const color = url.searchParams.get('color');
    if (color !== null) {
      if (color.length !== 7 || !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
      canonical.searchParams.set('color', color.toLowerCase());
    }
    for (const key of soundCloudFlags) {
      const flag = url.searchParams.get(key);
      if (flag === null) continue;
      if (flag !== 'true' && flag !== 'false') return null;
      canonical.searchParams.set(key, flag);
    }
    return {provider: 'soundcloud', src: canonical.href, height: canonical.searchParams.get('visual') === 'true' ? 300 : 166};
  }

  if (url.hostname === 'open.spotify.com') {
    const match = /^\/embed\/track\/([a-zA-Z0-9]{22})$/.exec(url.pathname);
    if (!match || keys.some(key => key !== 'utm_source')) return null;
    return {provider: 'spotify', src: `https://open.spotify.com/embed/track/${match[1]}`, height: 80};
  }

  if (url.hostname === 'www.youtube.com' || url.hostname === 'www.youtube-nocookie.com') {
    const match = /^\/embed\/([a-zA-Z0-9_-]{11})$/.exec(url.pathname);
    if (!match || keys.length !== 0) return null;
    return {provider: 'youtube', src: `https://${url.hostname}/embed/${match[1]}`, height: null, watchUrl: `https://www.youtube.com/watch?v=${match[1]}`};
  }
  return null;
}
