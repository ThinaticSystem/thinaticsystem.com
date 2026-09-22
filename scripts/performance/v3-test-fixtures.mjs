import {readFileSync} from 'node:fs';
import {requiredJourneyIds} from './contract.mjs';

export const policy = JSON.parse(readFileSync(new URL('./fixtures/performance-policy-v3.json', import.meta.url), 'utf8'));
export const baselineHash = 'a'.repeat(64);
export const candidateHash = 'b'.repeat(64);
export const fixtureHash = policy.warmScope.fixtureSha256;
export const harnessHash = policy.warmScope.harnessSha256;

export function observation(side, attemptOrdinal, calibration = false) {
  return {
    schema: 'thinaticsystem/performance-observation/v1', side, attemptOrdinal,
    browser: {version: '153.0.8010.12', executablePath: '/fixture/chromium'},
    fixtureSha256: fixtureHash, harnessSha256: harnessHash,
    buildSha256: calibration || side === 'candidate' ? candidateHash : baselineHash,
    profile: {id: 'desktop-normal-loopback-v1', viewport: {width: 1280, height: 900}, reducedMotion: 'no-preference', httpCache: 'routed-disabled', cpuRate: 1, network: 'loopback-fixture'},
    journeys: requiredJourneyIds.map((id, index) => {
      const cold = index < 3; const interaction = index >= 8;
      return {id, entryKind: cold ? 'cold' : interaction ? 'interaction' : 'spa-warm', clockOrigin: cold ? 'navigation' : 'trusted-input', elapsedInMs: 200, ready: true,
        ...(id.startsWith('mobile.') ? {viewport: {width: 375, height: 812}} : {}),
        resources: [{id: `context-${attemptOrdinal}-${index}:request-1`, url: 'http://127.0.0.1:4174/chunk.js', category: 'code', scope: 'action', terminal: 'finished', decodedBodySizeInBytes: 1000}], requestCount: 1};
    }), errors: [], cleanup: true,
  };
}

export function evidence() {
  const observations = policy.schedule.map((side, index) => observation(side, index));
  const calibration = policy.calibrationSchedule.map((side, index) => observation(side, index, true));
  const receipt = item => ({side: item.side, attemptOrdinal: item.attemptOrdinal, status: 0, signal: null, timedOut: false, cleanup: true, stderr: '', runtime: 'v24.19.0'});
  return {observations, calibration, assets: {initial: {rawBytes: 440_000, gzipBytes: 120_000, brotliBytes: 100_000}, allEmittedJsCssRawBytes: 700_000, baseline: {initial: {rawBytes: 440_000, gzipBytes: 120_000, brotliBytes: 100_000}, allEmittedJsCssRawBytes: 700_000}}, policy: structuredClone(policy), receipts: {observations: observations.map(receipt), calibration: calibration.map(receipt)}};
}
