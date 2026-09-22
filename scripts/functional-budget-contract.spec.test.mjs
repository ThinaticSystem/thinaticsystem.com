import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateFunctionalBudget} from './functional-budget-contract.mjs';

const names = ['desktop.home', 'desktop.theme-toggle', 'desktop.blog-list', 'desktop.blog-article', 'desktop.blog-back', 'desktop.discography', 'mobile.menu-blog'];
const missing = ['cold direct blog article', 'cold direct discography detail', 'discography list to detail transition'];
const changed = ['desktop.blog-list', 'desktop.blog-article', 'desktop.discography'];

function fixture() {
  const caps = [[602_955, 7, 12], [0, 0, 0], [20_480, 3, 6], [7_168, 2, 3], [0, 0, 2], [5_120, 2, 4], [624_526, 10, 18]];
  const policy = {
    schema: 'thinaticsystem/functional-budget/v1', id: 'required-features-v1',
    initial: {rawBytes: 458_752, gzipBytes: 131_072, brotliBytes: 114_688},
    detailChunkRawBytes: 16_384, allEmittedJsCssRawBytes: 819_200,
    journeys: Object.fromEntries(names.map((name, index) => [name, {rawBytes: caps[index][0], resourceCount: caps[index][1], requestCount: caps[index][2]}])),
    timingMaxRelativeRegression: 0.2, unmeasuredScopes: [...missing],
  };
  const observation = name => ({
    timesInMs: [100, 90, 110, 100],
    requestCounts: Array(4).fill(policy.journeys[name].requestCount),
    resourceSummaries: Array.from({length: 4}, () => ({count: policy.journeys[name].resourceCount, decodedBodySizeInBytes: policy.journeys[name].rawBytes, transferSizeInBytes: 0})),
  });
  const measurement = {
    initial: {...policy.initial}, baselineInitial: {...policy.initial},
    detailChunkRawBytes: policy.detailChunkRawBytes, allEmittedJsCssRawBytes: policy.allEmittedJsCssRawBytes,
    journeys: names.map(name => ({name, baseline: observation(name), candidate: observation(name)})),
  };
  return {policy, measurement};
}

function evaluate(change = () => {}) {
  const inputs = fixture();
  change(inputs);
  return evaluateFunctionalBudget(inputs.policy, inputs.measurement);
}

function assertInvalid(result) {
  assert.equal(result.valid, false);
  assert.equal(result.overall, 'FAIL');
  assert.ok(result.validationErrors.length > 0);
  for (const section of ['size', 'requests', 'timing', 'historical']) assert.equal(result[section].status, 'NOT_EVALUATED');
  assert.equal(result.coverage.status, 'BLOCKED');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
}

test('equal approved limits remain coverage BLOCKED, never production PASS', () => {
  const result = evaluate();
  assert.equal(result.schema, 'thinaticsystem/functional-budget-result/v1');
  assert.equal(result.valid, true);
  assert.deepEqual(result.validationErrors, []);
  assert.deepEqual(result.size, {status: 'PASS', failures: []});
  assert.deepEqual(result.requests, {status: 'PASS', failures: []});
  assert.deepEqual(result.timing, {status: 'COMPARABLE_WITHIN_PRESET_NOISE_RULE', failures: []});
  assert.deepEqual(result.historical, {status: 'PASS', sizeFailures: [], blockingFailures: []});
  assert.deepEqual(result.coverage, {status: 'BLOCKED', missing});
  assert.equal(result.overall, 'BLOCKED');
});

const assetCaps = [
  ...['rawBytes', 'gzipBytes', 'brotliBytes'].map(metric => ({name: `initial.${metric}`, limit: inputs => inputs.policy.initial[metric], set: (inputs, value) => { inputs.measurement.initial[metric] = value; }})),
  ...['detailChunkRawBytes', 'allEmittedJsCssRawBytes'].map(metric => ({name: metric, limit: inputs => inputs.policy[metric], set: (inputs, value) => { inputs.measurement[metric] = value; }})),
];
const routeCaps = names.map(name => ({name, limit: inputs => inputs.policy.journeys[name].rawBytes, set: (inputs, value) => { inputs.measurement.journeys.find(journey => journey.name === name).candidate.resourceSummaries[3].decodedBodySizeInBytes = value; }}));
for (const cap of [...assetCaps, ...routeCaps]) {
  for (const delta of [-1, 0, 1]) {
    if (delta === -1 && ['desktop.theme-toggle', 'desktop.blog-back'].includes(cap.name)) continue;
    test(`${cap.name}: ${delta < 0 ? 'below' : delta === 0 ? 'equal' : 'one over'} byte cap`, () => {
      const result = evaluate(inputs => cap.set(inputs, cap.limit(inputs) + delta));
      assert.equal(result.valid, true);
      assert.equal(result.size.status, delta > 0 ? 'FAIL' : 'PASS');
      assert.equal(result.overall, delta > 0 ? 'FAIL' : 'BLOCKED');
    });
  }
}

for (const name of names) {
  for (const metric of ['requestCount', 'resourceCount']) {
    for (const delta of [-1, 0, 1]) {
      const {policy} = fixture();
      if (policy.journeys[name][metric] + delta < 0) continue;
      test(`${name}: ${metric} approved cap delta ${delta}`, () => {
        const result = evaluate(({measurement}) => {
          const journey = measurement.journeys.find(row => row.name === name);
          if (metric === 'requestCount') journey.candidate.requestCounts[3] += delta;
          else journey.candidate.resourceSummaries[3].count += delta;
        });
        assert.equal(result.requests.status, delta > 0 ? 'FAIL' : 'PASS');
        assert.equal(result.overall, delta > 0 ? 'FAIL' : 'BLOCKED');
      });
    }
    if (fixture().policy.journeys[name][metric] > 0) {
      test(`${name}: ${metric} also cannot exceed fresh baseline maximum`, () => {
        const result = evaluate(({measurement}) => {
          const journey = measurement.journeys.find(row => row.name === name);
          if (metric === 'requestCount') journey.baseline.requestCounts = journey.baseline.requestCounts.map(value => value - 1);
          else journey.baseline.resourceSummaries.forEach(row => { row.count -= 1; });
        });
        assert.equal(result.requests.status, 'FAIL');
        assert.ok(result.historical.blockingFailures.length > 0);
        assert.equal(result.overall, 'FAIL');
      });
    }
  }
}

for (const name of ['desktop.home', 'mobile.menu-blog']) {
  test(`${name}: unchanged decoded bytes also obey fresh baseline maximum`, () => {
    const result = evaluate(({measurement}) => measurement.journeys.find(row => row.name === name).baseline.resourceSummaries.forEach(row => { row.decodedBodySizeInBytes -= 1; }));
    assert.equal(result.size.status, 'FAIL');
    assert.equal(result.historical.status, 'FAIL');
    assert.equal(result.overall, 'FAIL');
  });
}

for (const name of changed) {
  for (const blocking of ['none', 'request', 'resource', 'timing']) {
    test(`${name}: historical size is diagnostic, mixed ${blocking} failure stays blocking`, () => {
      const result = evaluate(({measurement}) => {
        const journey = measurement.journeys.find(row => row.name === name);
        journey.baseline.resourceSummaries.forEach(row => { row.decodedBodySizeInBytes = 1; });
        if (blocking === 'request') journey.candidate.requestCounts[3] += 1;
        if (blocking === 'resource') journey.candidate.resourceSummaries[3].count += 1;
        if (blocking === 'timing') journey.candidate.timesInMs = [121, 121, 121, 121];
      });
      assert.equal(result.size.status, 'PASS');
      assert.equal(result.historical.status, 'FAIL');
      assert.ok(result.historical.sizeFailures.length > 0);
      assert.equal(result.historical.blockingFailures.length > 0, blocking !== 'none');
      assert.equal(result.overall, blocking === 'none' ? 'BLOCKED' : 'FAIL');
    });
  }
}

for (const metric of ['rawBytes', 'gzipBytes', 'brotliBytes']) {
  test(`initial ${metric}: fresh historical size failure remains diagnostic`, () => {
    const result = evaluate(({measurement}) => { measurement.baselineInitial[metric] -= 1; });
    assert.equal(result.size.status, 'PASS');
    assert.equal(result.historical.status, 'FAIL');
    assert.equal(result.historical.sizeFailures.length, 1);
    assert.equal(result.overall, 'BLOCKED');
  });
}

for (const [label, times, expected] of [
  ['below', [119, 119, 119, 119], 'COMPARABLE_WITHIN_PRESET_NOISE_RULE'],
  ['equal', [120, 120, 120, 120], 'COMPARABLE_WITHIN_PRESET_NOISE_RULE'],
  ['above', [120.01, 120.01, 120.01, 120.01], 'INCONCLUSIVE_OR_FAIL'],
  ['unsorted middle two, not mean or supplied median', [1000, 100, 1, 140], 'COMPARABLE_WITHIN_PRESET_NOISE_RULE'],
]) {
  test(`fixed 20% median timing: ${label}`, () => {
    const result = evaluate(({measurement}) => { measurement.journeys[0].candidate.timesInMs = times; measurement.journeys[0].candidate.medianInMs = 1; });
    assert.equal(result.timing.status, expected);
    assert.equal(result.overall, expected === 'INCONCLUSIVE_OR_FAIL' ? 'FAIL' : 'BLOCKED');
  });
}

test('fresh baseline uses the middle two of four unsorted times', () => {
  const result = evaluate(({measurement}) => {
    measurement.journeys[0].baseline.timesInMs = [1000, 80, 100, 1];
    measurement.journeys[0].baseline.medianInMs = 1000;
    measurement.journeys[0].candidate.timesInMs = [109, 109, 109, 109];
  });
  assert.equal(result.timing.status, 'INCONCLUSIVE_OR_FAIL');
});

test('timing retains the prescribed (middle two sum)/2 rounding at equality', () => {
  const result = evaluate(({measurement}) => {
    measurement.journeys[0].baseline.timesInMs = [0.04, 0.01, 0.001, 0.03];
    measurement.journeys[0].candidate.timesInMs = [0.024, 0.024, 0.024, 0.024];
  });
  assert.equal(result.timing.status, 'COMPARABLE_WITHIN_PRESET_NOISE_RULE');
  assert.equal(result.overall, 'BLOCKED');
});

test('supplied PASS aggregates cannot conceal failing raw observations', () => {
  const result = evaluate(({measurement}) => {
    measurement.aggregate = {status: 'PASS'};
    const journey = measurement.journeys[0];
    journey.candidate.maxRequestCount = 0;
    journey.candidate.maxRawBytes = 0;
    journey.candidate.medianInMs = 1;
    journey.candidate.requestCounts[3] += 1;
    journey.candidate.resourceSummaries[2].decodedBodySizeInBytes += 1;
    journey.candidate.timesInMs = [121, 121, 121, 121];
  });
  assert.equal(result.size.status, 'FAIL');
  assert.equal(result.requests.status, 'FAIL');
  assert.equal(result.timing.status, 'INCONCLUSIVE_OR_FAIL');
});

test('all caps are conjunctive; independently report size, request and timing failures', () => {
  const result = evaluate(inputs => {
    for (const cap of assetCaps) cap.set(inputs, cap.limit(inputs) + 1);
    for (const cap of routeCaps) cap.set(inputs, cap.limit(inputs) + 1);
    inputs.measurement.journeys[0].candidate.requestCounts[0] += 1;
    inputs.measurement.journeys[0].candidate.timesInMs = [121, 121, 121, 121];
  });
  assert.equal(result.size.status, 'FAIL');
  assert.ok(result.size.failures.length >= 12);
  assert.equal(result.requests.status, 'FAIL');
  assert.equal(result.timing.status, 'INCONCLUSIVE_OR_FAIL');
  assert.equal(result.overall, 'FAIL');
});

test('fresh baseline maxima, not first observation or supplied aggregates, set ceilings', () => {
  const result = evaluate(({measurement}) => {
    const journey = measurement.journeys[0];
    journey.baseline.requestCounts = [1, 2, 12, 3];
    journey.baseline.resourceSummaries[0] = {count: 1, decodedBodySizeInBytes: 1, transferSizeInBytes: 0};
    journey.baseline.maxRequestCount = 1;
    journey.baseline.maxRawBytes = 1;
    journey.candidate.aggregate = {rawBytes: 999_999_999, requestCount: 999};
  });
  assert.equal(result.overall, 'BLOCKED');
});

test('policy caps still bind when fresh baseline maxima are higher', () => {
  const result = evaluate(({measurement}) => {
    const journey = measurement.journeys[0];
    journey.baseline.requestCounts[2] = 100;
    journey.baseline.resourceSummaries[2].count = 100;
    journey.baseline.resourceSummaries[2].decodedBodySizeInBytes = 999_999;
    journey.candidate.requestCounts[3] += 1;
    journey.candidate.resourceSummaries[3].count += 1;
    journey.candidate.resourceSummaries[3].decodedBodySizeInBytes += 1;
  });
  assert.equal(result.requests.status, 'FAIL');
  assert.equal(result.size.status, 'FAIL');
  assert.equal(result.overall, 'FAIL');
});

const malformed = [
  ['empty measurement', inputs => { inputs.measurement = {}; }],
  ['missing initial', ({measurement}) => { delete measurement.initial; }],
  ['missing baselineInitial', ({measurement}) => { delete measurement.baselineInitial; }],
  ['unknown journey', ({measurement}) => { measurement.journeys[0].name = 'unknown'; }],
  ['duplicate journey', ({measurement}) => { measurement.journeys[1].name = measurement.journeys[0].name; }],
  ['missing journey', ({measurement}) => { measurement.journeys.pop(); }],
  ['extra journey', ({measurement}) => { measurement.journeys.push(measurement.journeys[0]); }],
  ['reordered journeys', ({measurement}) => { measurement.journeys.reverse(); }],
  ['nonarray journeys', ({measurement}) => { measurement.journeys = {}; }],
  ['null journey', ({measurement}) => { measurement.journeys[0] = null; }],
  ['sparse journeys', ({measurement}) => { delete measurement.journeys[0]; }],
  ['missing baseline', ({measurement}) => { delete measurement.journeys[0].baseline; }],
  ['null policy', inputs => { inputs.policy = null; }],
  ['unknown schema', ({policy}) => { policy.schema = 'unknown'; }],
  ['unknown policy id', ({policy}) => { policy.id = 'unapproved'; }],
  ['missing policy journey', ({policy}) => { delete policy.journeys[names[0]]; }],
  ['unknown policy journey', ({policy}) => { policy.journeys.unknown = {}; }],
  ['reordered policy journeys', ({policy}) => { policy.journeys = Object.fromEntries(Object.entries(policy.journeys).reverse()); }],
  ['cleared coverage', ({policy}) => { policy.unmeasuredScopes = []; }],
  ['partial coverage', ({policy}) => { policy.unmeasuredScopes.pop(); }],
  ['unknown coverage', ({policy}) => { policy.unmeasuredScopes[0] = 'other'; }],
  ['missing coverage', ({policy}) => { delete policy.unmeasuredScopes; }],
  ['relaxed timing', ({policy}) => { policy.timingMaxRelativeRegression = 0.3; }],
  ['changed timing rule', ({policy}) => { policy.timingMaxRelativeRegression = 0.1; }],
  ['missing timing rule', ({policy}) => { delete policy.timingMaxRelativeRegression; }],
];
for (const [label, change] of malformed) test(`reject ${label}`, () => assertInvalid(evaluate(change)));
for (const value of [undefined, null, false, 1, 'measurement', []]) test(`reject measurement ${String(value)}`, () => assertInvalid(evaluateFunctionalBudget(fixture().policy, value)));

for (const side of ['baseline', 'candidate']) {
  for (const field of ['timesInMs', 'requestCounts', 'resourceSummaries']) {
    for (const length of [0, 3, 5]) test(`reject ${side}.${field} length ${length}`, () => assertInvalid(evaluate(({measurement}) => {
      const observation = measurement.journeys[0][side];
      observation[field] = Array(length).fill(observation[field][0]);
    })));
    test(`reject ${side}.${field} sparse array`, () => assertInvalid(evaluate(({measurement}) => { delete measurement.journeys[0][side][field][1]; })));
    test(`reject ${side}.${field} nonarray`, () => assertInvalid(evaluate(({measurement}) => { measurement.journeys[0][side][field] = {}; })));
  }
  for (const value of [NaN, Infinity, -1, 0, '100', null]) test(`reject ${side} timing ${String(value)}`, () => assertInvalid(evaluate(({measurement}) => { measurement.journeys[0][side].timesInMs[1] = value; })));
}

const integerFields = [
  ...['initial', 'baselineInitial'].flatMap(section => ['rawBytes', 'gzipBytes', 'brotliBytes'].map(metric => ({name: `${section}.${metric}`, set: (inputs, value) => { inputs.measurement[section][metric] = value; }}))),
  ...assetCaps.slice(3),
  ...['baseline', 'candidate'].flatMap(side => [
    {name: `${side}.requestCounts`, set: (inputs, value) => { inputs.measurement.journeys[0][side].requestCounts[1] = value; }},
    ...['count', 'decodedBodySizeInBytes', 'transferSizeInBytes'].map(metric => ({name: `${side}.${metric}`, set: (inputs, value) => { inputs.measurement.journeys[0][side].resourceSummaries[1][metric] = value; }})),
  ]),
  ...['rawBytes', 'gzipBytes', 'brotliBytes'].map(metric => ({name: `policy.initial.${metric}`, set: (inputs, value) => { inputs.policy.initial[metric] = value; }})),
  ...['detailChunkRawBytes', 'allEmittedJsCssRawBytes'].map(metric => ({name: `policy.${metric}`, set: (inputs, value) => { inputs.policy[metric] = value; }})),
  ...['rawBytes', 'resourceCount', 'requestCount'].map(metric => ({name: `policy.journey.${metric}`, set: (inputs, value) => { inputs.policy.journeys[names[0]][metric] = value; }})),
];
for (const field of integerFields) {
  for (const value of [NaN, Infinity, -1, 0.5, '1', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    test(`reject ${field.name} invalid integer ${String(value)}`, () => assertInvalid(evaluate(inputs => field.set(inputs, value))));
  }
}

test('no argument throws; malformed access is a validation result', () => {
  assertInvalid(evaluateFunctionalBudget());
  const {policy, measurement} = fixture();
  Object.defineProperty(measurement, 'initial', {get() { throw new Error('bad input accessor'); }});
  assertInvalid(evaluateFunctionalBudget(policy, measurement));
});

test('does not mutate inputs, sort caller arrays, or alias returned coverage', () => {
  const {policy, measurement} = fixture();
  const before = structuredClone({policy, measurement});
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  }
  freeze(policy); freeze(measurement);
  const first = evaluateFunctionalBudget(policy, measurement);
  assert.deepEqual(evaluateFunctionalBudget(policy, measurement), first);
  first.coverage.missing.pop();
  assert.deepEqual({policy, measurement}, before);
  assert.deepEqual(evaluateFunctionalBudget(policy, measurement).coverage.missing, missing);
});

test('extra policy metadata does not alter the approved numeric contract', () => {
  const result = evaluate(({policy}) => { policy.approval = {approved: true}; policy.measurementBindings = {}; policy.applicationBoundary = {}; });
  assert.equal(result.overall, 'BLOCKED');
});

test('very large finite positive timings produce finite JSON-safe results', () => {
  const result = evaluate(({measurement}) => {
    measurement.journeys[0].baseline.timesInMs = Array(4).fill(Number.MAX_VALUE);
    measurement.journeys[0].candidate.timesInMs = Array(4).fill(Number.MAX_VALUE);
  });
  assert.equal(result.valid, true);
  assert.equal(result.timing.status, 'COMPARABLE_WITHIN_PRESET_NOISE_RULE');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
