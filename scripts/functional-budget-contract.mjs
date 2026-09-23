const journeyNames = Object.freeze(['desktop.home', 'desktop.theme-toggle', 'desktop.blog-list', 'desktop.blog-article', 'desktop.blog-back', 'desktop.discography', 'mobile.menu-blog']);
const changedRouteSizes = new Set(['desktop.blog-list', 'desktop.blog-article', 'desktop.discography']);
const unmeasuredScopes = Object.freeze(['cold direct blog article', 'cold direct discography detail', 'discography list to detail transition']);
const initialMetrics = Object.freeze(['rawBytes', 'gzipBytes', 'brotliBytes']);
const emittedMetrics = Object.freeze(['detailChunkRawBytes', 'allEmittedJsCssRawBytes']);
const journeyMetrics = Object.freeze(['rawBytes', 'resourceCount', 'requestCount']);
const resourceMetrics = Object.freeze(['count', 'decodedBodySizeInBytes', 'transferSizeInBytes']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameOrderedNames(value, expected) {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (value[index] !== expected[index]) return false;
  }
  return true;
}

function readCounters(value, metrics, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: expected a counter record`);
    return null;
  }
  const counters = {};
  for (const metric of metrics) {
    const counter = value[metric];
    if (!Number.isSafeInteger(counter) || counter < 0) errors.push(`${path}.${metric}: expected a nonnegative safe integer`);
    counters[metric] = counter;
  }
  return counters;
}

function readObservation(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an observation record`);
    return null;
  }
  const observation = {timesInMs: [], requestCounts: [], resourceSummaries: []};
  for (const field of ['timesInMs', 'requestCounts', 'resourceSummaries']) {
    const observations = value[field];
    if (!Array.isArray(observations) || observations.length !== 4) {
      errors.push(`${path}.${field}: exactly four observations required`);
      continue;
    }
    for (let index = 0; index < 4; index += 1) {
      const item = observations[index];
      const itemPath = `${path}.${field}[${index}]`;
      if (field === 'resourceSummaries') {
        observation[field].push(readCounters(item, resourceMetrics, itemPath, errors));
      } else {
        const valid = field === 'timesInMs'
          ? Number.isFinite(item) && item > 0
          : Number.isSafeInteger(item) && item >= 0;
        if (!valid) errors.push(`${itemPath}: expected ${field === 'timesInMs' ? 'positive finite milliseconds' : 'a nonnegative safe integer'}`);
        observation[field].push(item);
      }
    }
  }
  return observation;
}

function readPolicy(value, errors) {
  if (!isRecord(value)) {
    errors.push('policy: expected a record');
    return null;
  }
  if (value.schema !== 'thinaticsystem/functional-budget/v1') errors.push('policy.schema: unsupported schema');
  if (value.id !== 'required-features-v1') errors.push('policy.id: unsupported policy');
  if (value.timingMaxRelativeRegression !== 0.2) errors.push('policy.timingMaxRelativeRegression: the preset 20% rule cannot change');
  if (!sameOrderedNames(value.unmeasuredScopes, unmeasuredScopes)) errors.push('policy.unmeasuredScopes: fixed unmeasured coverage cannot be removed or changed');
  const policy = {
    initial: readCounters(value.initial, initialMetrics, 'policy.initial', errors),
    ...readCounters(value, emittedMetrics, 'policy', errors),
    journeys: {},
  };
  const journeys = value.journeys;
  if (!isRecord(journeys) || !sameOrderedNames(Object.keys(journeys), journeyNames)) {
    errors.push('policy.journeys: exactly the seven approved journeys in order required');
    return policy;
  }
  for (const name of journeyNames) policy.journeys[name] = readCounters(journeys[name], journeyMetrics, `policy.journeys.${name}`, errors);
  return policy;
}

function readMeasurement(value, errors) {
  if (!isRecord(value)) {
    errors.push('measurement: expected a record');
    return null;
  }
  const measurement = {
    initial: readCounters(value.initial, initialMetrics, 'measurement.initial', errors),
    baselineInitial: readCounters(value.baselineInitial, initialMetrics, 'measurement.baselineInitial', errors),
    ...readCounters(value, emittedMetrics, 'measurement', errors),
    journeys: [],
  };
  const journeys = value.journeys;
  if (!Array.isArray(journeys) || journeys.length !== journeyNames.length) {
    errors.push('measurement.journeys: exactly seven journeys required');
    return measurement;
  }
  for (let index = 0; index < journeyNames.length; index += 1) {
    const journey = journeys[index];
    const path = `measurement.journeys[${index}]`;
    if (!isRecord(journey)) {
      errors.push(`${path}: expected a journey record`);
      continue;
    }
    const name = journey.name;
    if (name !== journeyNames[index]) errors.push(`${path}.name: expected ${journeyNames[index]}; unknown, duplicate, missing or reordered journey`);
    measurement.journeys.push({
      name,
      baseline: readObservation(journey.baseline, `${path}.baseline`, errors),
      candidate: readObservation(journey.candidate, `${path}.candidate`, errors),
    });
  }
  return measurement;
}

function invalidResult(validationErrors) {
  return {
    schema: 'thinaticsystem/functional-budget-result/v1', valid: false, validationErrors,
    size: {status: 'NOT_EVALUATED', failures: []},
    requests: {status: 'NOT_EVALUATED', failures: []},
    timing: {status: 'NOT_EVALUATED', failures: []},
    historical: {status: 'NOT_EVALUATED', sizeFailures: [], blockingFailures: []},
    coverage: {status: 'BLOCKED', missing: [...unmeasuredScopes]}, overall: 'FAIL',
  };
}

function medianOfFour(timesInMs) {
  const sorted = [...timesInMs].sort((left, right) => left - right);
  const middleSumInMs = sorted[1] + sorted[2];
  // NOTE: Preserve the prescribed sum/2 rounding; only avoid overflow when needed.
  return Number.isFinite(middleSumInMs) ? middleSumInMs / 2 : sorted[1] + (sorted[2] - sorted[1]) / 2;
}

function recordExceedance(failures, scope, metric, actual, limit, basis) {
  if (actual > limit) failures.push({scope, metric, actual, limit, basis});
}

function compareMeasurements(policy, measurement) {
  const sizeFailures = [];
  const requestFailures = [];
  const timingFailures = [];
  const historicalSizeFailures = [];
  for (const metric of initialMetrics) {
    recordExceedance(sizeFailures, 'initial', metric, measurement.initial[metric], policy.initial[metric], 'approved-policy');
    recordExceedance(historicalSizeFailures, 'initial', metric, measurement.initial[metric], measurement.baselineInitial[metric], 'fresh-baseline');
  }
  for (const metric of emittedMetrics) recordExceedance(sizeFailures, 'emitted-assets', metric, measurement[metric], policy[metric], 'approved-policy');
  for (const {name, baseline, candidate} of measurement.journeys) {
    const cap = policy.journeys[name];
    const baselineRawBytes = Math.max(...baseline.resourceSummaries.map(row => row.decodedBodySizeInBytes));
    const candidateRawBytes = Math.max(...candidate.resourceSummaries.map(row => row.decodedBodySizeInBytes));
    recordExceedance(sizeFailures, name, 'rawBytes', candidateRawBytes, cap.rawBytes, 'approved-policy');
    recordExceedance(historicalSizeFailures, name, 'rawBytes', candidateRawBytes, baselineRawBytes, 'fresh-baseline');
    if (!changedRouteSizes.has(name)) recordExceedance(sizeFailures, name, 'rawBytes', candidateRawBytes, baselineRawBytes, 'fresh-baseline');

    const candidateRequests = Math.max(...candidate.requestCounts);
    const baselineRequests = Math.max(...baseline.requestCounts);
    const candidateResources = Math.max(...candidate.resourceSummaries.map(row => row.count));
    const baselineResources = Math.max(...baseline.resourceSummaries.map(row => row.count));
    recordExceedance(requestFailures, name, 'requestCount', candidateRequests, cap.requestCount, 'approved-policy');
    recordExceedance(requestFailures, name, 'requestCount', candidateRequests, baselineRequests, 'fresh-baseline');
    recordExceedance(requestFailures, name, 'resourceCount', candidateResources, cap.resourceCount, 'approved-policy');
    recordExceedance(requestFailures, name, 'resourceCount', candidateResources, baselineResources, 'fresh-baseline');

    const baselineMedianInMs = medianOfFour(baseline.timesInMs);
    const candidateMedianInMs = medianOfFour(candidate.timesInMs);
    recordExceedance(timingFailures, name, 'medianInMs', candidateMedianInMs, baselineMedianInMs * 1.2, 'preset-20-percent-median-rule');
  }
  const blockingFailures = [...requestFailures, ...timingFailures];
  return {
    schema: 'thinaticsystem/functional-budget-result/v1', valid: true, validationErrors: [],
    size: {status: sizeFailures.length ? 'FAIL' : 'PASS', failures: sizeFailures},
    requests: {status: requestFailures.length ? 'FAIL' : 'PASS', failures: requestFailures},
    timing: {status: timingFailures.length ? 'INCONCLUSIVE_OR_FAIL' : 'COMPARABLE_WITHIN_PRESET_NOISE_RULE', failures: timingFailures},
    historical: {status: historicalSizeFailures.length || blockingFailures.length ? 'FAIL' : 'PASS', sizeFailures: historicalSizeFailures, blockingFailures},
    coverage: {status: 'BLOCKED', missing: [...unmeasuredScopes]},
    overall: sizeFailures.length || blockingFailures.length ? 'FAIL' : 'BLOCKED',
  };
}

/**
 * Evaluate the versioned functional budget from four raw observations per side.
 * Inputs are borrowed, never mutated; only validated scalar snapshots enter comparisons.
 * Bytes and counts are nonnegative safe integers, timings positive finite milliseconds.
 * Failures identify scope, metric, actual, limit and the policy/baseline comparison basis.
 * Malformed inputs return valid:false with NOT_EVALUATED sections, rather than throwing.
 * Historical size failures are diagnostic; unchanged-scope sizes, requests and timing
 * independently block. Coverage always blocks release, even when every measured cap fits.
 * Policy approval, real measurement provenance and application-boundary validation belong
 * to the calling adapter; metadata and supplied aggregates confer no authority here.
 */
export function evaluateFunctionalBudget(policy, measurement) {
  const errors = [];
  try {
    const capturedPolicy = readPolicy(policy, errors);
    const capturedMeasurement = readMeasurement(measurement, errors);
    if (errors.length) return invalidResult(errors);
    return compareMeasurements(capturedPolicy, capturedMeasurement);
  } catch {
    return invalidResult([...errors, 'Inputs could not be read as functional-budget data']);
  }
}
