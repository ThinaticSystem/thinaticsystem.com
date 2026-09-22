export default {
  test: {
    include: ['scripts/known-defects/fixtures/**/*.fixture.mjs'],
    reporters: [['./scripts/known-defect-reporter.mjs', {}]],
  },
};
