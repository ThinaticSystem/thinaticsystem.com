import {setTimeout as delay} from 'node:timers/promises';

/** Seed only an origin-bearing document; about:blank has no accessible storage. */
export function initializeTheme() {
  if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('theme', 'light');
}

/** Browser-only semantic adapter. Tags/text/native accessible names identify content;
 * CSS is read only for geometry/visibility, never for application identity. rAF is
 * a rendering opportunity, not proof of compositor paint or an INP measurement.
 */
export function installPageRecorder(initial = null) {
  const normalize = value => (value ?? '').replace(/\s+/g, ' ').trim();
  const name = element => normalize(element.getAttribute('aria-label') ?? element.getAttribute('alt') ?? element.textContent);
  const find = (target, root = document) => [...root.querySelectorAll(target.tags)].filter(element => {
    const value = target.name !== undefined || target.names !== undefined ? name(element) : normalize(element.textContent);
    return target.names !== undefined ? target.names.includes(value) : target.containsText !== undefined ? normalize(element.textContent).includes(target.containsText) : target.name !== undefined ? value === target.name : target.text !== undefined ? value === target.text : true;
  });
  function usable(element) {
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (parent.hidden || parent.inert || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) < 0.95) return false;
    }
    const box = element.getBoundingClientRect();
    const left = Math.max(box.left, 0), top = Math.max(box.top, 0);
    const right = Math.min(box.right, innerWidth), bottom = Math.min(box.bottom, innerHeight);
    if (right - left < 2 || bottom - top < 2) return false;
    // NOTE: Samples reject blocking overlays without waiting for unrelated motion.
    for (const [x, y] of [[(left + right) / 2, (top + bottom) / 2], [left + (right - left) / 4, top + (bottom - top) / 4], [right - (right - left) / 4, bottom - (bottom - top) / 4]]) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== element && !element.contains(hit))) return false;
    }
    return !(element instanceof HTMLImageElement) || Boolean(element.currentSrc && element.complete && element.naturalWidth > 0);
  }
  function matches(spec) {
    if (spec.path !== undefined && location.pathname !== spec.path) return false;
    const root = spec.main === false ? document : document.querySelector('main, [role="main"]');
    if (!root) return false;
    if ((root instanceof Element && root.getAttribute('aria-busy') === 'true') || root.querySelector('[aria-busy="true"]') || [...root.querySelectorAll('[role="status"]')].some(element => /読み込|読込|loading/i.test(element.textContent ?? ''))) return false;
    // COMPAT: The old full-screen loader can use pointer-events:none, which hit
    // testing alone cannot see. Identify its semantic image, then verify a large
    // visible enclosing surface. The current small decorative orbit is unrelated.
    for (const image of find({tags: 'img', name: '読込中...'})) {
      let opacity = 1;
      for (let element = image; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        opacity *= Number(style.opacity);
        if (style.display === 'none' || style.visibility !== 'visible') {opacity = 0; break;}
      }
      if (opacity > 0.01) {
        for (let element = image; element && element !== document.body; element = element.parentElement) {
          const box = element.getBoundingClientRect();
          if (box.width >= innerWidth * 0.8 && box.height >= innerHeight * 0.8) return false;
        }
      }
    }
    if (!spec.targets.every(target => find(target, root).some(usable))) return false;
    if (spec.absent?.some(target => find(target, document).some(usable))) return false;
    if (spec.theme !== undefined) {
      const dark = spec.theme === 'dark';
      if (localStorage.getItem('theme') !== spec.theme) return false;
      // COMPAT: Both pinned builds use bg-white/dark:bg-gray-800 and inverse text.
      // Observe computed presentation, not only persisted intent or class names.
      const style = getComputedStyle(document.body);
      if (style.backgroundColor !== (dark ? 'rgb(31, 41, 55)' : 'rgb(255, 255, 255)') || style.color !== (dark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)')) return false;
      // COMPAT: The historical button lacks aria-pressed; current a11y QA requires it.
      for (const target of spec.targets) for (const element of find(target, root)) {
        const pressed = element.getAttribute('aria-pressed');
        if (pressed !== null && pressed !== String(dark)) return false;
      }
    }
    return true;
  }
  let active = null;
  let frame = null;
  const results = {};
  const sample = () => {
    frame = null;
    if (!active || active.startInMs === null) return;
    if (matches(active.spec)) {
      const endInMs = performance.now();
      results[active.id] = {startInMs: active.startInMs, endInMs, elapsedInMs: endInMs - active.startInMs,
        timeOrigin: performance.timeOrigin, ready: true, clockOrigin: active.clockOrigin,
        witness: {path: location.pathname, targets: active.spec.targets, viewport: {width: innerWidth, height: innerHeight},
          ...(active.spec.theme === undefined ? {} : {theme:{mode:active.spec.theme, backgroundColor:getComputedStyle(document.body).backgroundColor, color:getComputedStyle(document.body).color}})}};
      active = null;
      return;
    }
    frame = requestAnimationFrame(sample);
  };
  function arm({id, spec, clockOrigin, trigger = null}) {
    if (frame !== null) cancelAnimationFrame(frame);
    active = {id, spec, clockOrigin, trigger, startInMs: clockOrigin === 'navigation' ? 0 : null};
    delete results[id];
    if (active.startInMs !== null) frame = requestAnimationFrame(sample);
  }
  function start(event) {
    if (!active || active.startInMs !== null || !event.isTrusted) return;
    const trigger = active.trigger;
    if (!trigger || event.type !== trigger.event) return;
    if (trigger.key && event.key !== trigger.key) return;
    if (trigger.name && !event.composedPath().some(element => element instanceof Element && name(element) === trigger.name)) return;
    active.startInMs = performance.now();
    frame = requestAnimationFrame(sample);
  }
  document.addEventListener('click', start, true);
  document.addEventListener('keydown', start, true);
  window.__performanceRecorder = {arm, results, matches};
  if (initial) arm(initial);
}

/** Deterministic begin-owned ledger; caller supplies IDs, timestamps and terminal outcomes. */
export function createRequestLedger(prefix) {
  const records = new Map();
  let sequence = 0;
  return {
    begin(key, {url, category, owner, startInMs}) {
      if (records.has(key)) throw new Error('Duplicate request begin');
      const record = {id: `${prefix}:${++sequence}`, url, category, owner, startInMs, terminal: 'unknown', decodedBodySizeInBytes: null};
      records.set(key, record);
      return record.id;
    },
    terminal(key, terminal, decodedBodySizeInBytes = null, startInMs = null) {
      const record = records.get(key);
      if (!record) throw new Error('Terminal without request begin');
      if (record.terminal !== 'unknown') throw new Error('Duplicate request terminal');
      if (!['finished', 'failed'].includes(terminal)) throw new Error('Invalid terminal');
      record.terminal = terminal;
      record.decodedBodySizeInBytes = decodedBodySizeInBytes;
      if (startInMs !== null && startInMs >= 0) record.startInMs = startInMs;
    },
    pending(owner) { return [...records.values()].filter(record => record.owner === owner && record.terminal === 'unknown').length; },
    snapshot(owner, endInMs) {
      return [...records.values()].filter(record => record.owner === owner).map(({owner: ignoredOwner, startInMs, ...record}) => ({...record, scope: startInMs <= endInMs ? 'action' : 'tail'}));
    },
    count() { return records.size; },
  };
}

function category(request) {
  const type = request.resourceType();
  if (type === 'script' || type === 'stylesheet') return 'code';
  if (type === 'document') return 'document';
  if (type === 'xhr' || type === 'fetch') return 'api';
  if (type === 'image' || type === 'font') return type;
  return 'other';
}

/** Own context events through context closure, including requests begun while draining.
 * Tail is a declared observation window, not a sleep used to establish UI readiness.
 */
export function attachRequestRecorder(context, {prefix, errors, tailInMs = 250, drainInMs = 5_000}) {
  const ledger = createRequestLedger(prefix);
  let owner = null;
  const readers = new Set();
  const activeKeys = new Set();
  const onRequest = request => {
    ledger.begin(request, {url: request.url(), category: category(request), owner,
      startInMs: performance.timeOrigin + performance.now()});
    activeKeys.add(request);
    if (owner === null) errors.push(`Unowned request: ${request.method()} ${request.url()}`);
  };
  const onFinished = request => {
    const read = (async () => {
      let bytes = null;
      try {
        const response = await request.response();
        if (response) {
          if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${request.url()}`);
          bytes = (await response.body()).length;
        }
      } catch (error) { errors.push(`Response body unavailable: ${request.url()}: ${String(error)}`); }
      ledger.terminal(request, 'finished', bytes, request.timing().startTime);
      activeKeys.delete(request);
    })().catch(error => errors.push(`Request recorder: ${String(error)}`));
    readers.add(read);
    void read.finally(() => readers.delete(read));
  };
  const onFailed = request => {
    ledger.terminal(request, 'failed', null, request.timing().startTime);
    activeKeys.delete(request);
    errors.push(`Request failed: ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`);
  };
  context.on('request', onRequest);
  context.on('requestfinished', onFinished);
  context.on('requestfailed', onFailed);
  context.on('console', message => { if (message.type() === 'error') errors.push(`Console: ${message.text()}`); });
  context.on('weberror', webError => errors.push(`Page error: ${String(webError.error())}`));
  async function drain() {
    const deadline = performance.now() + drainInMs;
    let stableCount = -1;
    while (performance.now() < deadline) {
      // NOTE: Recompute the cut after every turn: children can begin during body reads.
      if (ledger.pending(owner) === 0 && readers.size === 0 && ledger.count() === stableCount) return true;
      stableCount = ledger.count();
      await delay(25);
    }
    errors.push(`Request drain timeout: ${prefix}/${owner}`);
    return false;
  }
  return {
    begin(id) { if (owner !== null) throw new Error('Overlapping resource scopes'); owner = id; },
    async finish(endEpochInMs) {
      const id = owner;
      await delay(tailInMs);
      await drain();
      const resources = ledger.snapshot(id, endEpochInMs);
      owner = null;
      return resources;
    },
    async close() {
      // NOTE: Listeners deliberately remain installed until browser context disposal.
      await drain();
      await context.close();
      await Promise.all([...readers]);
      if (activeKeys.size) errors.push(`Requests not terminal after context close: ${activeKeys.size}`);
    },
    ledger,
  };
}

/** Collect a page-native endpoint; protocol polling only retrieves an already stamped result. */
export async function readEndpoint(page, id, timeoutInMs = 15_000) {
  await page.waitForFunction(id => Boolean(window.__performanceRecorder?.results[id]), id, {timeout: timeoutInMs, polling: 'raf'});
  return page.evaluate(id => window.__performanceRecorder.results[id], id);
}
