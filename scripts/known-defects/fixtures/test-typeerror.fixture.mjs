import {test} from 'vitest';

test('actual TypeError in test body', () => {
  throw new TypeError('fixture TypeError in test body');
});
