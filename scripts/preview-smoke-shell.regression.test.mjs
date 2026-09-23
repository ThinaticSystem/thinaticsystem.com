import assert from "node:assert/strict";
import test from "node:test";
import {hasAngularShell} from "./preview-smoke-shell.mjs";

test("Given a preview document when checking the Angular shell then only an app-root tag with a valid tag-name boundary is accepted", () => {
  assert.equal(hasAngularShell("<app-root></app-root>"), true);
  assert.equal(hasAngularShell("<APP-ROOT lang=\"ja\"></APP-ROOT>"), true);
  assert.equal(hasAngularShell("<app-rooted></app-rooted>"), false);
  assert.equal(hasAngularShell("<app-root-custom></app-root-custom>"), false);
  assert.equal(hasAngularShell("<main>no application shell</main>"), false);
});
