import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {chromium} from 'playwright';

// NOTE: Native CSS fixture only; the full application/GIF/lifecycle is covered by parent browser QA.
test('Given the loading corner receives edge, child, and motion state when corner or child state changes Then native corner headings hold on edges, survive child replacement, and reset for reduced motion', async () => {
  const styles = readFileSync(process.env.CORNER_CSS_SOURCE ?? new URL('./styles.scss', import.meta.url), 'utf8');
  const start = styles.indexOf('.loading-feedback {');
  const end = styles.indexOf('\n.markdown-body {', start);
  assert(start >= 0 && end > start);
  const css = styles.slice(start, end).replace(/\/\/[^\n]*/g, '');
  const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? '/home/ts/site-development/thinaticsystem.com/.artifacts/dependency-modernization-2026-09-10T15-49-53-297Z/chromium'});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}, reducedMotion: 'no-preference'});
    await page.route('**/*', route => route.abort());
    await page.setContent(`<style>${css}</style><div class="loading-feedback"><div class="loading-artwork" role="status" aria-label="Loading"><picture><img alt="" width="48" height="48"></picture></div></div>`);
    const status = page.getByRole('status', {name: 'Loading'});
    for (const [time, heading] of [[0, 0], [8000, 0], [15999, 0], [16000, -90], [24000, -90], [31999, -90], [32000, -180], [40000, -180], [47999, -180], [48000, -270], [56000, -270], [63999, -270], [64000, 0], [80000, -90]]) {
      const state = await status.evaluate((element, timeInMs) => {
        for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = timeInMs; }
        const child = element.firstElementChild;
        if (!child) throw new Error('Missing decorative child');
        const rect = element.getBoundingClientRect();
        const parent = getComputedStyle(element), art = getComputedStyle(child);
        return {parentRotate: parent.rotate, heading: art.rotate === 'none' ? 0 : parseFloat(art.rotate), x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      }, time);
      assert.equal(state.heading, heading, `heading at ${time}ms`);
      assert(['none', '0deg'].includes(state.parentRotate), 'translation owner must never rotate');
      // NOTE: Native translated DOMRects have subpixel floating-point rounding.
      assert(Math.abs(state.width - 48) < 0.0001);
      assert(Math.abs(state.height - 48) < 0.0001);
      if (time % 16000 === 0) {
        const corners = [[16, 836], [1216, 836], [1216, 16], [16, 16]];
        const [x, y] = corners[(time / 16000) % 4];
        assert.equal(state.x, x); assert.equal(state.y, y);
      }
      console.log(JSON.stringify({time, ...state}));
    }
    const fallbackHeading = await status.evaluate(element => {
      for (const animation of element.getAnimations()) animation.currentTime = 48000;
      // NOTE: A native replacement witnesses inherited phase without restarting the stable owner.
      element.firstElementChild.replaceWith(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
      return getComputedStyle(element.firstElementChild).rotate;
    });
    assert.equal(fallbackHeading, '-270deg');
    await page.emulateMedia({reducedMotion: 'reduce'});
    const reduced = await status.evaluate(element => ({animations: element.getAnimations().length, heading: getComputedStyle(element.firstElementChild).rotate, transform: getComputedStyle(element).transform}));
    assert.deepEqual(reduced, {animations: 0, heading: '0deg', transform: 'none'});
    console.log(JSON.stringify({browser: browser.version(), fallbackHeading, reduced}));
  } finally { await browser.close(); }
});
