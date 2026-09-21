import {mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';

const viewport = {width: 375, height: 812};
const openName = 'メニューを開きます';
const closeName = 'メニューを閉じます';
const describeError = error => error?.stack ?? String(error);
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Observe native playback only: never seek, pause, replace CSS, or delay input.
 * rAF/computed opacity is diagnostic evidence, not compositor paint or INP.
 * A 1ms animation may start and end in one rendering opportunity.
 */
function installMenuMotionRecorder() {
  const traces = [];
  const byElement = new WeakMap();
  document.addEventListener('animationstart', event => {
    const element = event.target;
    if (!(element instanceof Element) || event.animationName !== 'fadeIn' ||
        !(element.localName === 'nav' || element.getAttribute('role') === 'navigation')) return;
    const animation = element.getAnimations().find(item => item.animationName === 'fadeIn');
    const trace = {ordinal: traces.length + 1, timeOrigin: performance.timeOrigin,
      startedInMs: performance.now(), eventElapsedInSeconds: event.elapsedTime,
      timing: animation?.effect?.getTiming() ?? null, samples: [], terminal: null};
    traces.push(trace);
    byElement.set(element, trace);
    let frame = null;
    const sample = () => {
      frame = null;
      trace.samples.push({atInMs: performance.now(), opacity: Number(getComputedStyle(element).opacity),
        currentTimeInMs: animation?.currentTime ?? null, playState: animation?.playState ?? null});
      if (!element.isConnected) trace.terminal = 'detached';
      else if (!animation) trace.terminal = 'animation-unavailable';
      else if (animation.playState === 'finished') trace.terminal = 'finished';
      else if (animation.playState === 'idle') trace.terminal = 'cancelled';
      else if (performance.now() - trace.startedInMs >= 5_000) trace.terminal = 'trace-timeout';
      if (trace.terminal) {
        trace.endedInMs = performance.now();
        trace.intermediateOpacityObserved = trace.samples.some(item => item.opacity > 0 && item.opacity < 1);
        return;
      }
      frame = requestAnimationFrame(sample);
    };
    // NOTE: Observe insertion before protocol retries can miss the short animation.
    sample();
    window.addEventListener('pagehide', () => {if (frame !== null) cancelAnimationFrame(frame);}, {once: true});
  }, true);
  window.__menuMotion = {traces, byElement};
}

async function main() {
  const {values} = parseArgs({options: {dist: {type: 'string'}, output: {type: 'string'}}});
  if (!values.dist || !values.output) throw new Error('Usage: node scripts/performance/verify-menu-motion.mjs --dist <build> --output <fresh-directory>; output parent must exist');
  const distRoot = realpathSync(resolve(values.dist));
  const requestedOutput = resolve(values.output);
  const output = join(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
  if (output === distRoot || output.startsWith(distRoot + sep)) throw new Error('Evidence must be outside the immutable build');
  mkdirSync(output); // SAFETY: Exclusive directory acquisition; never overwrite a prior run.
  const errors = [];
  const result = {schema: 'thinaticsystem/menu-motion/v1', verdict: 'FAIL', buildSha256: null,
    fixtureSha256: null, scriptSha256: null, node: process.version, browser: null,
    viewport, profiles: [], errors, cleanup: {browser: false, server: false},
    notes: ['Standalone regression; existing performance endpoints and policy are unchanged.',
      'Actual CSSAnimation timing is the gate; opacity traces and endpoint timings are diagnostics.',
      'Screenshots follow completed endpoints and native motion, outside action timers.',
      'Fresh contexts; routed HTTP cache disabled; loopback build and exact owned fixtures only.']};
  const json = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  let browser = null;
  let server = null;
  let captureIdentity = null;
  const check = (condition, message) => {if (!condition) errors.push(message);};
  try {
    // NOTE: Dependency/setup failures also leave the exclusively owned result.json.
    const [{chromium}, {browserEnvironment}, {captureBuildIdentity}, {serveBuild, endpoints},
      {fixtureFor, fixtureSha256}, {initializeTheme, installPageRecorder, attachRequestRecorder, readEndpoint}] = await Promise.all([
      import('playwright'), import('../browser-environment.mjs'), import('../paired-identity.mjs'),
      import('./collector.mjs'), import('./fixtures.mjs'), import('./recorder.mjs'),
    ]);
    captureIdentity = captureBuildIdentity;
    result.scriptSha256 = sha256(new URL(import.meta.url));
    result.fixtureSha256 = fixtureSha256;
    const build = captureBuildIdentity(distRoot);
    result.buildSha256 = build.sha256;
    json('build.json', build);
    server = await serveBuild(distRoot, build, errors);
    const executablePath = process.env.BROWSER_EXECUTABLE_PATH ?? chromium.executablePath();
    browser = await chromium.launch({headless: true, executablePath, env: await browserEnvironment(),
      args: ['--no-sandbox', '--disable-dev-shm-usage']});
    result.browser = {executablePath, version: browser.version()};

    for (const reducedMotion of ['no-preference', 'reduce']) {
      const profile = {reducedMotion, expectedDurationInMs: reducedMotion === 'reduce' ? 1 : 500,
        viewport: null, endpoints: [], openings: [], screenshots: [], traces: [], resources: [], cleanup: false};
      result.profiles.push(profile);
      let context = null;
      let requests = null;
      let page = null;
      const prefix = reducedMotion === 'reduce' ? 'reduced' : 'normal';
      const screenshot = async name => {
        const file = `${prefix}-${name}.png`;
        await page.screenshot({path: join(output, file), fullPage: true, timeout: 10_000});
        profile.screenshots.push(file);
      };
      try {
        context = await browser.newContext({viewport, reducedMotion, colorScheme: 'light', serviceWorkers: 'block'});
        // NOTE: Own errors before newPage, and requests until context closure (one lifetime scope).
        requests = attachRequestRecorder(context, {prefix, errors});
        requests.begin(prefix);
        context.setDefaultTimeout(10_000);
        context.setDefaultNavigationTimeout(20_000);
        await context.route('**/*', async route => {
          try {
            const request = route.request();
            const fixture = fixtureFor(request.url(), request.method());
            if (fixture) {await route.fulfill(fixture); return;}
            const url = new URL(request.url());
            if (request.method() === 'GET' && url.origin === server.origin && !url.search && server.allowedPath(url.pathname)) {
              await route.continue(); return;
            }
            errors.push(`Unmatched network fixture: ${request.method()} ${request.url()}`);
            await route.abort('blockedbyclient');
          } catch (error) {
            errors.push(`Fixture routing: ${describeError(error)}`);
            try {await route.abort('failed');} catch (abortError) {errors.push(`Fixture abort: ${describeError(abortError)}`);}
          }
        });
        await context.addInitScript(initializeTheme);
        await context.addInitScript(installMenuMotionRecorder);
        await context.addInitScript(installPageRecorder, {id: 'home', spec: endpoints.home, clockOrigin: 'navigation'});
        page = await context.newPage();
        page.on('crash', () => errors.push(`${prefix}: page crashed`));
        await page.goto(server.origin + '/', {waitUntil: 'domcontentloaded'});
        profile.endpoints.push({id: 'home', ...await readEndpoint(page, 'home')});
        profile.viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches}));
        check(profile.viewport.width === viewport.width && profile.viewport.height === viewport.height &&
          profile.viewport.reducedMotion === (reducedMotion === 'reduce'), `${prefix}: viewport/motion preference mismatch`);

        const action = async (id, spec, control, name) => {
          await control.waitFor({state: 'visible'});
          await page.evaluate(input => window.__performanceRecorder.arm(input),
            {id, spec, clockOrigin: 'trusted-input', trigger: {event: 'click', name}});
          await control.click();
          const endpoint = await readEndpoint(page, id);
          profile.endpoints.push({id, ...endpoint});
        };
        let previousTraceOrdinal = 0;
        const open = async ordinal => {
          await action(`open-${ordinal}`, endpoints.menuOpen, page.getByRole('button', {name: openName, exact: true}), openName);
          // NOTE: Role + Blog link delimit navigation candidates; native effect ownership
          // distinguishes the opened surface from desktop/footer navigation without classes.
          const candidates = page.getByRole('navigation').filter({has: page.getByRole('link', {name: 'Blog', exact: true})});
          const observations = await candidates.evaluateAll(elements => elements.map(element => ({
            name: element.getAttribute('aria-label'),
            animations: element.getAnimations().map(animation => ({name: animation.animationName ?? null,
              timing: animation.effect?.getTiming() ?? null, keyframes: animation.effect?.getKeyframes() ?? [],
              playState: animation.playState, currentTimeInMs: animation.currentTime})),
            trace: window.__menuMotion.byElement.get(element) ?? null,
          })));
          const owners = observations.filter(item => item.animations.some(animation => animation.name === 'fadeIn'));
          profile.openings.push({ordinal, candidates: observations});
          if (owners.length !== 1) throw new Error(`${prefix}/open-${ordinal}: expected one semantic navigation owning fadeIn, got ${owners.length}`);
          const fades = owners[0].animations.filter(animation => animation.name === 'fadeIn');
          check(fades.length === 1, `${prefix}/open-${ordinal}: duplicate fadeIn effects`);
          const fade = fades[0];
          // NOTE: Keep this exact failure diagnostic for the old 1000ms build's RED proof.
          check(fade.timing?.duration === profile.expectedDurationInMs,
            `${prefix}/open-${ordinal}: fadeIn duration ${fade.timing?.duration}ms; expected ${profile.expectedDurationInMs}ms`);
          check(fade.timing?.fill === 'both' && fade.timing?.iterations === 1 && fade.timing?.delay === 0,
            `${prefix}/open-${ordinal}: fadeIn fill/iterations/delay changed`);
          const first = fade.keyframes[0];
          const last = fade.keyframes.at(-1);
          check(first?.computedOffset === 0 && first.opacity === '0' && last?.computedOffset === 1 && last.opacity === '1',
            `${prefix}/open-${ordinal}: fadeIn opacity keyframes not retained`);
          // NOTE: Filled animations remain observable even after reduced-motion's 1ms finish.
          await page.waitForFunction(() => window.__menuMotion.traces.length > 0 &&
            window.__menuMotion.traces.every(trace => trace.terminal !== null), null, {polling: 'raf', timeout: 6_000});
          profile.traces = await page.evaluate(() => window.__menuMotion.traces);
          check(owners[0].trace !== null && owners[0].trace.ordinal > previousTraceOrdinal,
            `${prefix}/open-${ordinal}: fresh native animationstart trace missing`);
          previousTraceOrdinal = owners[0].trace?.ordinal ?? previousTraceOrdinal;
          check(profile.traces.every(trace => trace.terminal === 'finished'), `${prefix}/open-${ordinal}: native animation did not finish`);
          await screenshot(`open-${ordinal}`);
          return candidates.nth(observations.indexOf(owners[0]));
        };
        for (const ordinal of [1, 2]) {
          await open(ordinal);
          await action(`close-${ordinal}`, endpoints.menuClosed, page.getByRole('button', {name: closeName, exact: true}), closeName);
          await screenshot(`closed-${ordinal}`);
        }
        const navigation = await open(3);
        const blog = navigation.getByRole('link', {name: 'Blog', exact: true});
        await action('blog', endpoints.blog, blog, 'Blog');
        check(new URL(page.url()).pathname === '/blog', `${prefix}: Blog click did not navigate to /blog`);
        await page.getByRole('heading', {name: 'Blog', exact: true}).waitFor({state: 'visible'});
        await page.getByRole('button', {name: openName, exact: true}).waitFor({state: 'visible'});
        check(await page.getByRole('button', {name: closeName, exact: true}).count() === 0,
          `${prefix}: menu remains open after Blog navigation`);
        await screenshot('blog');
      } catch (error) {
        errors.push(`${prefix}: ${describeError(error)}`);
        if (page && !page.isClosed()) {
          try {await screenshot('failure');} catch (diagnosticError) {errors.push(`${prefix} failure screenshot: ${describeError(diagnosticError)}`);}
        }
      } finally {
        if (page && !page.isClosed()) {
          try {
            profile.traces = await page.evaluate(() => window.__menuMotion?.traces ?? []);
            profile.partialEndpoints = await page.evaluate(() => window.__performanceRecorder?.results ?? {});
          } catch (error) {errors.push(`${prefix} partial diagnostics: ${describeError(error)}`);}
        }
        try {
          if (requests) await requests.close();
          else if (context) await context.close();
          profile.cleanup = true;
        } catch (error) {
          errors.push(`${prefix} context cleanup: ${describeError(error)}`);
          try {await context?.close(); profile.cleanup = true;} catch (fallbackError) {errors.push(`${prefix} fallback cleanup: ${describeError(fallbackError)}`);}
        } finally {
          if (requests) profile.resources = requests.ledger.snapshot(prefix, Number.POSITIVE_INFINITY);
        }
        // NOTE: Closure-time errors and request terminals are included in final admission.
        json(`${prefix}.json`, profile);
      }
    }
  } catch (error) {
    errors.push(`Run: ${describeError(error)}`);
  } finally {
    try {await browser?.close(); result.cleanup.browser = true;} catch (error) {errors.push(`Browser cleanup: ${describeError(error)}`);}
    try {await server?.close(); result.cleanup.server = true;} catch (error) {errors.push(`Server cleanup: ${describeError(error)}`);}
    if (captureIdentity && result.buildSha256 !== null) {
      try {check(captureIdentity(distRoot).sha256 === result.buildSha256, 'Build changed during regression');}
      catch (error) {errors.push(`Build identity: ${describeError(error)}`);}
    }
    check(result.profiles.length === 2 && result.profiles.every(profile => profile.cleanup && profile.openings.length === 3 &&
      profile.endpoints.some(endpoint => endpoint.id === 'blog')), 'Incomplete normal/reduced repeated-menu coverage');
    result.verdict = errors.length === 0 && result.cleanup.browser && result.cleanup.server ? 'PASS' : 'FAIL';
    json('result.json', result);
  }
  process.stdout.write(JSON.stringify({verdict: result.verdict, output, errors}) + '\n');
  if (result.verdict !== 'PASS') process.exitCode = 1;
}

main().catch(error => {process.stderr.write(describeError(error) + '\n'); process.exitCode = 1;});
