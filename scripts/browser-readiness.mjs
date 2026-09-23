/**
 * Wait for the existing loading image to fade before observing animations.
 * This semantic lifecycle signal occurs after the async loading callback; observing
 * animations before it misses transitions not yet created. Never hides the loader.
 * @throws When loading or finite motion does not settle within the bounded deadline.
 */
export async function waitForVisualReady(page) {
  const indicator = page.getByAltText('読込中...', {exact: true});
  if (await indicator.count()) {
    await indicator.evaluate((image) => new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {cancelAnimationFrame(frame); reject(new Error('Loading indicator did not finish'));}, 10_000);
      let frame;
      const check = () => {
        const style = getComputedStyle(image);
        if (!image.isConnected || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
          clearTimeout(deadline); resolve();
        } else frame = requestAnimationFrame(check);
      };
      check();
    }));
  }
  await page.evaluate(() => new Promise((resolve, reject) => {
    let frame;
    let settledFrames = 0;
    const deadline = setTimeout(() => {cancelAnimationFrame(frame); reject(new Error('Finite page motion did not settle'));}, 10_000);
    const check = () => {
      const unfinished = document.getAnimations().some((animation) =>
        animation.effect?.getTiming().iterations !== Infinity &&
        (animation.pending || animation.playState === 'running'));
      settledFrames = unfinished ? 0 : settledFrames + 1;
      if (settledFrames >= 2) {clearTimeout(deadline); resolve();}
      else frame = requestAnimationFrame(check);
    };
    document.fonts.ready.then(check, (error) => {clearTimeout(deadline); reject(error);});
  }));
}
