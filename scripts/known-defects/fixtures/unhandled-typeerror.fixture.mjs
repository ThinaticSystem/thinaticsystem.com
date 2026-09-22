import {test} from 'vitest';

test('actual unhandled asynchronous error', async () => {
  setTimeout(() => {
    throw new TypeError('fixture unhandled TypeError');
  }, 0);
  await new Promise((resolve) => setTimeout(resolve, 10));
});
