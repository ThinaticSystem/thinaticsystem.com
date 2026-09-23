import {beforeEach, test} from 'vitest';

beforeEach(() => {
  throw new TypeError('fixture TypeError in beforeEach');
});

test('actual beforeEach failure', () => undefined);
