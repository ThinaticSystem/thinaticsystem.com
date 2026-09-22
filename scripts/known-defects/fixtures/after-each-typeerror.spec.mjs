import {afterEach, test} from 'vitest';

afterEach(() => {
  throw new TypeError('fixture TypeError in afterEach');
});

test('actual afterEach failure', () => undefined);
