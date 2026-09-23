import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

export const browserFont = Object.freeze({
  family: 'Noto Sans JP',
  emoji: {family: 'Noto Color Emoji', revision: 'f3ae03f5e9b3b8516fa151f7168159ca1a3e7515', sha256: '72a635cb3d2f3524c51620cdde406b217204e8a6a06c6a096ff8ed4b5fd6e27b'},
  revision: '66a36c8c94b1a5d992ee4e7f392fccfe4945767c',
  file: 'NotoSansJP[wght].ttf',
  sha256: 'c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f',
});

/** Supply a hash-pinned Linux capture font without changing app CSS or system font configuration. */
export async function browserEnvironment() {
  if (process.platform !== 'linux') throw new Error('Pinned fontconfig capture requires Linux; use the project Nix environment.');
  const directory = resolve('.artifacts/browser-fonts');
  mkdirSync(directory, {recursive: true});
  const base = `https://raw.githubusercontent.com/google/fonts/${browserFont.revision}/ofl/notosansjp/`;
  for (const [name, hash, source = base] of [[browserFont.file, browserFont.sha256], ['OFL.txt', '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9'], ['NotoColorEmoji.ttf', browserFont.emoji.sha256, `https://raw.githubusercontent.com/googlefonts/noto-emoji/${browserFont.emoji.revision}/fonts/`], ['LICENSE', '6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2', `https://raw.githubusercontent.com/googlefonts/noto-emoji/${browserFont.emoji.revision}/fonts/`]]) {
    const path = join(directory, name);
    if (!existsSync(path)) {
      const response = await fetch(source + encodeURIComponent(name), {signal: AbortSignal.timeout(30_000)});
      if (!response.ok) throw new Error(`Font download failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Font integrity failure: ${name}`);
      writeFileSync(path, bytes, {flag: 'wx'});
    }
    if (createHash('sha256').update(readFileSync(path)).digest('hex') !== hash) throw new Error(`Cached font integrity failure: ${name}`);
  }
  const escapeXml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const configuration = join(directory, 'fonts.conf');
  writeFileSync(configuration, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${escapeXml(directory)}</dir><cachedir>${escapeXml(join(directory, 'cache'))}</cachedir><alias><family>sans-serif</family><prefer><family>Noto Sans JP</family></prefer></alias><alias><family>system-ui</family><prefer><family>Noto Sans JP</family></prefer></alias></fontconfig>`);
  return {...process.env, FONTCONFIG_FILE: configuration, FONTCONFIG_PATH: directory};
}
