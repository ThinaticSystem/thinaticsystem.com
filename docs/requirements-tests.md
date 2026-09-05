# Requirement-to-test inventory

This inventory keeps requirement evidence separate from implementation scaffolds. A PASS here means the named behavior was exercised with a deterministic fixture; it does not claim live CMS, production Cloudflare, visual inspection, or screen-reader acceptance.

| Requirement / boundary | Executable evidence | Status and scope |
|---|---|---|
| Blog empty response | `src/app/blog/index/index.component.ts/.html` | DEBT: baseline renders the empty state, but no approved remediation assertion is registered |
| Blog HTTP failure | `src/app/blog/index/index.component.ts` | DEBT FAIL: baseline request error has no recoverable UI assertion; retained as pre-existing product debt |
| Blog concurrent page changes | `src/app/blog/index/index.component.ts` | DEBT FAIL: a late older response can overwrite the newest page; retained as pre-existing product debt |
| Article route parameter changes | `src/app/blog/article/article.component.ts` | DEBT FAIL: baseline reads the initial snapshot only; retained as pre-existing product debt |
| Article 404 vs 500 | `src/app/blog/article/article.component.ts` | DEBT FAIL: baseline redirects 404 but propagates other errors; retained as pre-existing product debt |
| Nested article/tag navigation | `src/known-defects/blog-card.nested-anchor.spec.ts` | REGISTERED FAIL: both semantic destinations and keyboard stops are asserted; the existing nested-anchor product defect remains intentionally unfixed |
| Markdown/HTML executable content | `src/app/pipes/sanitize-html.pipe.ts` | DEBT / SECURITY REVIEW REQUIRED: baseline sanitizer bypass remains; no security remediation is claimed |
| Clipboard rejection | `src/app/components/share/share.component.ts/.html` | DEBT FAIL: baseline has no rejection handler; retained as pre-existing product debt |
| Notification lifetime | `src/app/services/notification.service.ts` | DEBT FAIL: baseline timers are not cancelled when a notification is replaced; retained as pre-existing product debt |
| Discography image failure / empty result | `src/app/discography/discography.component.ts/.html` | DEBT FAIL: baseline waits for load events only and does not settle zero-item loading; retained as pre-existing product debt |
| Date boundary semantics | Existing Angular date rendering remains covered only by route/browser fixtures | PARTIAL: explicit year-boundary fixture is still a follow-up if date timezone policy is changed |
| iframe allowlist policy | `src/app/pipes/sanitize-html.pipe.ts` and the detail template | DEBT / SECURITY REVIEW REQUIRED: baseline trusts HTML; no security remediation is claimed |
| Live CMS / patron API | Browser and delivery scripts use owned loopback fixtures | NOT RUN: live account/data access is intentionally out of scope |
| Visual and screen-reader operation | Browser smoke records axe, keyboard and focus observations | NOT RUN: human visual inspection and representative screen-reader operation remain pending |

The ordinary suite's creation tests are retained where they document Angular wiring, but they are not used as evidence for the boundary rows above. The rows marked DEBT FAIL are preserved baseline findings, not green requirements; fixing them requires separate scope approval and focused assertions. The known-defect contract accepts only the structured runner report for the registered assertion and requires the child process to exit with status 1.
