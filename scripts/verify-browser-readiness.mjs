import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserEnvironment, browserFont} from './browser-environment.mjs';
const {waitForVisualReady} = await import(process.env.READINESS_MODULE ?? './browser-readiness.mjs');
const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH, env: await browserEnvironment(), args: ['--no-sandbox', '--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({colorScheme: 'light', reducedMotion: 'reduce'});
  await page.setContent(`<h1>しなちくシステム2024年01月01日✨</h1><div role="status" aria-label="Loading cover" style="position:fixed;inset:0;height:100vh;background:green;transition:height 200ms"></div><img alt="読込中..." src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" style="opacity:1"><button>Finish loading</button>`);
  await page.getByRole('button', {name: 'Finish loading'}).evaluate((button) => {
    button.addEventListener('click', () => setTimeout(() => {
      document.images[0].style.opacity = '0';
      // Fixture-only ownership: status element is the simulated loading cover.
      document.getElementsByTagName('div')[0].style.height = '0';
    }, 150));
    button.click();
  });
  await waitForVisualReady(page);
  assert.equal((await page.getByRole('status', {name: 'Loading cover'}).boundingBox()).height, 0, 'Late-created loading transition must finish, not merely semantic visibility');
  // Semantic text lookup is deliberately not accepted as font-coverage evidence.
  await page.getByRole('heading').evaluate((element) => {window.__fontProbe = element;});
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('DOM.getDocument');
  const {result} = await cdp.send('Runtime.evaluate', {expression: 'window.__fontProbe'});
  const {nodeId} = await cdp.send('DOM.requestNode', {objectId: result.objectId});
  const fonts = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
  assert(fonts.fonts.some((font) => font.postScriptName === 'NotoSansJP-Thin' && font.glyphCount > 0), JSON.stringify(fonts));
  assert(fonts.fonts.some((font) => font.familyName === 'Noto Color Emoji' && font.glyphCount > 0), 'Emoji fallback must render the sparkle');
  await page.setContent('<h1>Ready without a loader</h1>'); await waitForVisualReady(page);
  await page.setContent('<img alt="読込中..." style="opacity:1">');
  await assert.rejects(waitForVisualReady(page), /Loading indicator did not finish/);
  console.log(JSON.stringify({lateTransition: 'PASS', absentLoader: 'PASS', stuckLoader: 'REJECTED', platformFonts: fonts, browser: browser.version(), font: browserFont}));
} finally {await browser.close();}
