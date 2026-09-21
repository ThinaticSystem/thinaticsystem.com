import {test as nodeTest, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {browserEnvironment} from '../browser-environment.mjs';
import {initializeTheme, installPageRecorder, readEndpoint, attachRequestRecorder} from './recorder.mjs';

// NOTE: Run with node --test --test-reporter=tap scripts/performance/verify-recorder.mjs.
// These are real Chromium canaries of instrumentation, not app or provider acceptance.
const test = (name, run) => nodeTest(name, {timeout: 20_000}, run);
let browser, server, origin;
const held = new Map();
const arrivals = new Map();
const spec = {targets: [{tags: 'h1', text: 'Reader'}, {tags: 'p', text: 'Body'}, {tags: 'button', name: 'Control'}]};
const html = '<!doctype html><meta charset="utf-8"><main><h1>Reader</h1><p>Body</p><button>Control</button></main>';
before(async () => {
  server = createServer((request, response) => {
    if (request.url === '/parent' || request.url === '/child') {
      held.set(request.url, response);
      arrivals.get(request.url)?.();
      return;
    }
    if (request.url === '/favicon.ico') {response.writeHead(204); response.end(); return;}
    response.writeHead(200, {'content-type': 'text/html'}); response.end(html);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? chromium.executablePath(), env: await browserEnvironment(), args: ['--no-sandbox', '--disable-dev-shm-usage']});
});
after(async () => {
  try {await browser?.close();} finally {
    if (server) {server.closeAllConnections(); await new Promise(done => server.close(done));}
  }
});
async function contextFor(initial = null) {
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'no-preference', serviceWorkers: 'block'});
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.addInitScript(installPageRecorder, initial);
  return context;
}
async function probe(edit) {
  const context = await contextFor();
  try {
    const page = await context.newPage();
    await page.goto(origin);
    if (edit) await page.evaluate(edit);
    return await page.evaluate(spec => window.__performanceRecorder.matches(spec), spec);
  } finally {await context.close();}
}

test('theme bootstrap survives about:blank and seeds the actual origin', async () => {
  const context = await contextFor();
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.addInitScript(initializeTheme);
    const page = await context.newPage();
    await page.goto(origin);
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light');
  } finally {await context.close();}
  assert.deepEqual(errors, []);
});

test('the same named navigation intent supports historical buttons and current links', async () => {
  const context = await contextFor();
  try {
    const page = await context.newPage(); await page.goto(origin);
    for (const tag of ['a', 'button']) {
      const match = await page.evaluate(tag => {
        const target = document.createElement(tag); target.textContent = 'Continue';
        if (tag === 'a') target.href = '/next';
        const main = document.querySelector('main'); main.replaceChildren(target);
        return window.__performanceRecorder.matches({targets: [{tags:'a,button', name:'Continue'}]});
      }, tag);
      assert.equal(match, true);
    }
  } finally {await context.close();}
});

test('theme timing waits for rendered colors and pressed state, not persistence alone', async () => {
  const context = await contextFor();
  try {
    const page = await context.newPage(); await page.goto(origin);
    const theme = {theme:'dark', targets:[{tags:'button', name:'Control'}]};
    await page.evaluate(theme => {
      document.body.style.backgroundColor = 'rgb(255, 255, 255)'; document.body.style.color = 'rgb(0, 0, 0)';
      const button = document.querySelector('button'); button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => localStorage.setItem('theme', 'dark'));
      window.__performanceRecorder.arm({id:'delayed-theme', spec:theme, clockOrigin:'trusted-input', trigger:{event:'click',name:'Control'}});
    }, theme);
    await page.getByRole('button', {name:'Control', exact:true}).click();
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert.equal(await page.evaluate(() => window.__performanceRecorder.results['delayed-theme'] ?? null), null);
    assert.equal(await page.evaluate(theme => window.__performanceRecorder.matches(theme), theme), false);
    await page.evaluate(() => document.querySelector('button').setAttribute('aria-pressed','true'));
    assert.equal(await page.evaluate(theme => window.__performanceRecorder.matches(theme), theme), false);
    const appliedAt = await page.evaluate(() => {
      document.body.style.backgroundColor = 'rgb(31, 41, 55)'; document.body.style.color = 'rgb(255, 255, 255)';
      return performance.now();
    });
    const endpoint = await readEndpoint(page, 'delayed-theme');
    assert.ok(endpoint.startInMs < appliedAt && endpoint.endInMs >= appliedAt);
    assert.equal(endpoint.witness.theme.backgroundColor, 'rgb(31, 41, 55)');
    await page.evaluate(() => document.querySelector('button').setAttribute('aria-pressed','false'));
    assert.equal(await page.evaluate(theme => window.__performanceRecorder.matches(theme), theme), false);
  } finally {await context.close();}
});

test('native readiness rejects visible content blocked by overlay', async () => {
  assert.equal(await probe(() => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999';
    document.body.append(overlay);
  }), false);
});

test('native readiness accepts usable content with a nonblocking animated orbit', async () => {
  assert.equal(await probe(() => {
    const orbit = document.createElement('div');
    orbit.setAttribute('aria-hidden', 'true');
    orbit.style.cssText = 'position:fixed;right:0;bottom:0;width:48px;height:48px;background:green;pointer-events:none';
    document.body.append(orbit);
    orbit.animate([{transform: 'rotate(0deg)'}, {transform: 'rotate(360deg)'}], {duration: 500, iterations: Infinity});
  }), true);
});

test('native readiness rejects a title and controls with missing body', async () => {
  assert.equal(await probe(() => document.querySelector('p').remove()), false);
});

test('native readiness rejects hidden ancestors, disabled controls and pending content', async () => {
  assert.equal(await probe(() => {document.querySelector('main').style.opacity = '0';}), false);
  assert.equal(await probe(() => {document.querySelector('button').disabled = true;}), false);
  assert.equal(await probe(() => {document.querySelector('main').setAttribute('aria-busy', 'true');}), false);
});

test('legacy full-screen loading image cannot bypass hit testing via pointer-events none', async () => {
  assert.equal(await probe(() => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;pointer-events:none';
    const image = document.createElement('img'); image.alt = '読込中...';
    overlay.append(image); document.body.append(overlay);
  }), false);
});

test('page clock arms before trusted semantic input and stamps before protocol retrieval', async () => {
  const context = await contextFor();
  try {
    const page = await context.newPage(); await page.goto(origin);
    await page.evaluate(spec => window.__performanceRecorder.arm({id: 'input', spec, clockOrigin: 'trusted-input', trigger: {event: 'click', name: 'Control'}}), spec);
    await page.evaluate(() => document.querySelector('button').click());
    assert.equal(await page.evaluate(() => window.__performanceRecorder.results.input ?? null), null);
    await page.getByRole('button', {name: 'Control', exact: true}).click();
    const endpoint = await readEndpoint(page, 'input');
    const retrievedAt = await page.evaluate(() => performance.now());
    assert.equal(endpoint.clockOrigin, 'trusted-input');
    assert.ok(endpoint.startInMs > 0 && endpoint.endInMs >= endpoint.startInMs && endpoint.endInMs <= retrievedAt);
  } finally {await context.close();}
});

test('begin-owned inflight parent and drain-born child both reach terminal; late errors survive close', async () => {
  const delayedSpec = {targets: [{tags: 'h1', text: 'Reader'}, {tags: 'p', text: 'Unblocked'}, {tags: 'button', name: 'Control'}]};
  const context = await contextFor({id: 'cold', spec: delayedSpec, clockOrigin: 'navigation'});
  const errors = [];
  const recorder = attachRequestRecorder(context, {prefix: 'canary', errors, tailInMs: 100, drainInMs: 3_000});
  let closed = false;
  try {
    recorder.begin('cold');
    const page = await context.newPage(); await page.goto(origin);
    const parentArrived = new Promise(done => arrivals.set('/parent', done));
    const childArrived = new Promise(done => arrivals.set('/child', done));
    await page.evaluate(() => {
      void fetch('/parent').then(response => response.text()).then(() => fetch('/child')).then(response => response.text()).then(() => console.error('canary-late-owned-error'));
    });
    await parentArrived;
    await page.evaluate(() => {document.querySelector('p').textContent = 'Unblocked';});
    const endpoint = await readEndpoint(page, 'cold');
    assert.equal(endpoint.startInMs, 0);
    assert.ok(recorder.ledger.pending('cold') >= 1);
    assert.equal(errors.length, 0);
    const finishing = recorder.finish(endpoint.timeOrigin + endpoint.endInMs);
    held.get('/parent').end('parent');
    await childArrived;
    assert.ok(recorder.ledger.pending('cold') >= 1);
    held.get('/child').end('child');
    const resources = await finishing;
    await recorder.close(); closed = true;
    const requests = resources.filter(resource => ['/parent', '/child'].includes(new URL(resource.url).pathname));
    assert.equal(requests.length, 2);
    assert.ok(requests.every(resource => resource.terminal === 'finished' && resource.decodedBodySizeInBytes > 0));
    assert.equal(requests.find(resource => resource.url.endsWith('/parent')).scope, 'action');
    assert.equal(requests.find(resource => resource.url.endsWith('/child')).scope, 'tail');
    assert.ok(errors.some(error => error === 'Console: canary-late-owned-error'));
    assert.equal(errors.filter(error => error !== 'Console: canary-late-owned-error').length, 0);
  } finally {
    for (const response of held.values()) if (!response.writableEnded) response.end('cleanup');
    held.clear(); arrivals.clear();
    if (!closed) await recorder.close();
  }
});
