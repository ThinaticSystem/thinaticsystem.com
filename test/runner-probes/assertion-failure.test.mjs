import {expect, test} from 'vitest';

test('actual assertion failure', () => {
  expect(true).toBe(false);
});
