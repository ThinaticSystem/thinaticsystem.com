import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, relative} from 'node:path';

const REPORT_SCHEMA = 'thinaticsystem-com/vitest-authoritative/v1';

export default class KnownDefectReporter {
  #hookStarts = new Map();
  #hookEnds = new Map();

  onHookStart(hook) {
    this.#recordHook(this.#hookStarts, hook);
  }

  onHookEnd(hook) {
    this.#recordHook(this.#hookEnds, hook);
  }

  onTestRunEnd(testModules, unhandledErrors, reason) {
    const testResults = testModules.map((module) => this.#moduleResult(module));
    const suites = testResults.flatMap((result) => result.suiteRecords);
    const assertions = testResults.flatMap((result) => result.assertionResults);
    const report = {
      schema: REPORT_SCHEMA,
      success: reason === 'passed' && unhandledErrors.length === 0,
      numTotalTestSuites: suites.length,
      numPassedTestSuites: suites.filter((suite) => suite.status === 'passed').length,
      numFailedTestSuites: suites.filter((suite) => suite.status === 'failed').length,
      numPendingTestSuites: suites.filter((suite) => suite.status === 'pending' || suite.status === 'skipped').length,
      numTotalTests: assertions.length,
      numPassedTests: assertions.filter((assertion) => assertion.status === 'passed').length,
      numFailedTests: assertions.filter((assertion) => assertion.status === 'failed').length,
      numPendingTests: assertions.filter((assertion) => assertion.status === 'pending' || assertion.status === 'skipped').length,
      numTodoTests: assertions.filter((assertion) => assertion.mode === 'todo').length,
      testResults: testResults.map(({suiteRecords, assertionResults, ...result}) => ({...result, assertionResults})),
      unhandledErrors: unhandledErrors.map(serializeError),
      runnerErrors: testResults.flatMap((result) => result.runnerErrors),
    };
    const outputPath = process.env['KNOWN_DEFECT_REPORT_PATH'] ?? '.artifacts/known-defects-report.json';
    mkdirSync(dirname(outputPath), {recursive: true});
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  #recordHook(store, hook) {
    const key = entityKey(hook.entity);
    const hooks = store.get(key) ?? [];
    hooks.push(hook.name);
    store.set(key, hooks);
  }

  #moduleResult(module) {
    const modulePath = relative(process.cwd(), module.moduleId).replaceAll('\\', '/');
    const suiteRecords = [];
    const assertionResults = [];
    const runnerErrors = module.errors().map((error) => ({
      origin: 'collection',
      ...serializeError(error),
    }));
    const visit = (entity, ancestors) => {
      if (entity.type === 'test') {
        const result = entity.result();
        const errors = result.errors ?? [];
        const hookFailure = unfinishedHook(this.#hookStarts, this.#hookEnds, entity);
        const failureDetails = errors.map((error) => ({
          origin: hookFailure ?? 'test',
          ...serializeError(error),
        }));
        assertionResults.push({
          ancestorTitles: ancestors,
          fullName: [...ancestors, entity.name].join(' '),
          status: result.state,
          mode: entity.options.mode,
          failureMessages: errors.map(errorMessage),
          failureDetails,
        });
        return;
      }
      const status = entity.state();
      suiteRecords.push({
        name: entity.type === 'module' ? modulePath : entity.fullName,
        status,
        message: entity.errors().map(errorMessage).join('\n'),
      });
      for (const child of entity.children.array()) {
        visit(child, entity.type === 'module' ? ancestors : [...ancestors, entity.name]);
      }
      for (const error of entity.errors()) {
        runnerErrors.push({
          origin: entity.type === 'module' ? 'collection' : 'suite',
          ...serializeError(error),
        });
      }
    };
    visit(module, []);
    return {name: modulePath, status: module.state(), message: '', assertionResults, suiteRecords, runnerErrors};
  }
}

function entityKey(entity) {
  return `${entity.type}\u0000${entity.module?.moduleId ?? entity.moduleId ?? ''}\u0000${entity.fullName ?? ''}`;
}

function unfinishedHook(starts, ends, entity) {
  const key = entityKey(entity);
  const started = starts.get(key) ?? [];
  const ended = ends.get(key) ?? [];
  const remaining = new Map();
  for (const name of started) remaining.set(name, (remaining.get(name) ?? 0) + 1);
  for (const name of ended) remaining.set(name, (remaining.get(name) ?? 0) - 1);
  return [...remaining.entries()].find(([, count]) => count > 0)?.[0] ?? null;
}

function serializeError(error) {
  const stacks = Array.isArray(error?.stacks) ? error.stacks.filter((stack) => stack && typeof stack.file === 'string').map((stack) => ({
    file: stack.file.replaceAll('\\', '/'),
    line: stack.line,
    column: stack.column,
  })) : [];
  return {
    name: typeof error?.name === 'string' ? error.name : null,
    message: errorMessage(error),
    location: stacks[0] ?? null,
    stacks,
  };
}

function errorMessage(error) {
  return typeof error?.message === 'string' ? error.message : String(error);
}
