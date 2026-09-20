import {isDeepStrictEqual} from 'node:util';
import {validateMeasurementControl} from './paired-baseline-control.mjs';
import {browserFont} from './browser-environment.mjs';

export const baselineSha = '33b4ef4e8d21276130127a61aede6f0a8e1c47cb';
export const schedule = Object.freeze(['baseline', 'candidate', 'candidate', 'baseline', 'candidate', 'baseline', 'baseline', 'candidate']);
export const journeyNames = Object.freeze(['desktop.home', 'desktop.theme-toggle', 'desktop.blog-list', 'desktop.blog-article', 'desktop.blog-back', 'desktop.discography', 'mobile.menu-blog']);
export const timingSubstrate = Object.freeze({fixture: 'owned synthetic CMS/API data', reducedMotion: 'reduce', readiness: 'loading image fade then finite motion settled before timer stop', font: browserFont, colorScheme: 'light', initialTheme: 'light', accessibility: 'axe scan after timer stop', server: 'loopback static artifact server'});
export const policy = Object.freeze({initialSizeMustNotIncrease: true, requestCountMustNotIncrease: true, routeResourceBytesMustNotIncrease: true, timing: {minimumRepeats: 3, maxRelativeRegression: 0.2, rule: 'Fixed ABBA/BAAB, four observations per side; all attempts retained, no automatic retries. A median above base by more than 20% is inconclusive/fail; never widen after observation.'}});

/** Exact observed axe identities, not an accessibility acceptance or an ID-wide suppression. */
export function axeIdentity(scans) {
  return scans.map(scan => ({name: scan.name, violations: scan.violations.map(v => ({id: v.id, impact: v.impact, targets: v.nodes.map(node => node.target)}))}));
}

/** Validate one completed child process before any measurements enter an aggregate. */
export function validateAttempt({side, receipt, evidence, debt, browser = null}) {
  const errors = debt?.schema === 'thinaticsystem/historical-performance-control/v2' ? validateMeasurementControl(debt,evidence) : [];
  if (!['baseline', 'candidate'].includes(side)) errors.push('Unknown side');
  if (receipt?.status !== (side === 'baseline' ? 1 : 0) || receipt?.signal !== null || receipt?.error !== null || receipt?.timedOut !== false || receipt?.stderr !== '') errors.push('Runner exit/signal/timeout/stderr anomaly');
  if (evidence?.schema !== 'thinaticsystem-modernization/browser-smoke/v4' || !isDeepStrictEqual(evidence?.timingSubstrate, timingSubstrate)) errors.push('Schema/font/theme/readiness mismatch');
  if (evidence?.browser?.name !== 'Chromium' || !/^\d+\.\d+\.\d+\.\d+$/.test(evidence?.browser?.version ?? '') || !evidence?.browser?.executablePath || (browser && !isDeepStrictEqual(browser, evidence?.browser))) errors.push('Browser mismatch or missing identity');
  if (evidence?.repeatCount !== 1 || !Array.isArray(evidence?.runs) || evidence.runs.length !== 1) return [...errors, 'Missing or invalid single run'];
  const run = evidence.runs[0];
  if (!isDeepStrictEqual(run.browser, evidence.browser) || run.repeat !== 1) errors.push('Run browser/repeat mismatch');
  if (!isDeepStrictEqual(run.journeys?.map(j => j.name), journeyNames)) errors.push('Missing/duplicate/reordered journey');
  for (const j of run.journeys ?? []) {
    if (!Number.isFinite(j.elapsedInMs) || j.elapsedInMs <= 0 || !Number.isInteger(j.requestCount) || j.requestCount < 0) errors.push('Invalid timing/request measurement');
    for (const key of ['count', 'transferSizeInBytes', 'decodedBodySizeInBytes']) if (!Number.isInteger(j.resourceSummary?.[key]) || j.resourceSummary[key] < 0) errors.push('Missing/invalid resource measurement');
  }
  for (const key of ['consoleErrors', 'failedRequests', 'blockedExternalRequests']) if (!Array.isArray(run[key]) || run[key].length !== 0) errors.push(`Unexpected ${key}`);
  if (!Array.isArray(run.pageErrors) || run.pageErrors.length > (side === 'baseline' ? 2 : 0) || run.pageErrors.some(e => e.message !== 'NG0953' || e.url !== 'http://127.0.0.1:4174/')) errors.push('Unknown page error');
  const scans = journeyNames.filter(name => name !== 'desktop.blog-back');
  if (!Array.isArray(run.a11y) || !isDeepStrictEqual(run.a11y.map(s => s.name), scans) || run.a11y.some(s => !Array.isArray(s.violations))) errors.push('Missing/duplicate accessibility scan');
  else if (side === 'baseline') {
    if (debt?.measurement && run.a11y.some(scan => scan.testEngine?.version !== debt.measurement.axe)) errors.push('Baseline scan engine mismatch');
    if (debt?.baseSha !== baselineSha || !isDeepStrictEqual(axeIdentity(run.a11y), debt.axe)) errors.push('Baseline axe debt changed, missing or unknown');
  } else if (run.a11y.some(s => s.violations.length)) errors.push('Candidate accessibility failure');
  const theme = run.observations?.find(o => o.name === 'desktop.theme-toggle');
  const mobile = run.observations?.find(o => o.name === 'mobile.viewport-and-reflow');
  if (!theme?.keyboard || !theme.focused || !mobile?.keyboardMenu || mobile.reducedMotion !== 'reduce' || !isDeepStrictEqual(mobile.viewport, {width: 375, height: 812}) || mobile.reflow?.clientWidth !== 375 || mobile.reflow?.scrollWidth !== 375) errors.push('Missing keyboard/viewport/reflow evidence');
  return errors;
}

/** Combine validated raw rows, never trust a supplied aggregate or select faster attempts. */
export function combineAttempts(items) {
  if (items.length !== 4) throw new Error('Exactly four observations per side required');
  const runs = items.flatMap(item => item.runs);
  return {...items[0], repeatCount: runs.length, runs, aggregate: {journeys: Object.fromEntries(journeyNames.map(name => {
    const rows = runs.map(run => run.journeys.find(j => j.name === name));
    const times = rows.map(row => row.elapsedInMs).sort((a, b) => a - b);
    return [name, {runs: times, medianInMs: (times[1] + times[2]) / 2, requestCounts: rows.map(row => row.requestCount), resourceSummaries: rows.map(row => row.resourceSummary)}];
  })), staticResourceSummaries: runs.map(run => run.staticResourceSummary)}};
}
