# Landing feedback evidence

The public landing access explanation panel was removed at the user's request. A feedback section now appears after the FAQ, immediately before the footer, with a footer anchor link.

## Tests

`apps/ops/src/components/LandingFeedback.test.tsx`: three passing tests cover a valid local save without a server request, rejection of whitespace-only messages, and storage failure retaining the draft without a false success message.

Ops typecheck, changed-file ESLint and production build pass. Main JavaScript is 249.09 kB; largest chunk is 383.37 kB, with no bundle-size warning. `git diff --check` passes. These are targeted checks; the full workspace suite was not rerun for this follow-up.

## Browser evidence

[browser-checks.json](./browser-checks.json) records anonymous production-browser checks: panel absent, feedback as the last main section, native validation, keyboard rating selection, local saving, persistence across refresh, Add more feedback resetting the form, zero POST requests and zero runtime exceptions. Desktop 1440 × 1000 and phone 390 × 844 have no horizontal overflow.

- [Desktop screenshot](./feedback-1440.png)
- [Phone screenshot](./feedback-390.png)

Both screenshots were visually reviewed. The offscreen skip link was hidden only during cropped screenshot capture to avoid a Chrome capture artifact; application behavior was unchanged.

## Frontend-only behavior

The form collects a required 1–5 rating, topic, optional name and required message. Submissions are saved under `wr.landing-feedback` in localStorage with a creation timestamp. The confirmation explicitly states that feedback remains in this browser and has not been sent to the team. No API endpoint, database migration or shared database write was added. Existing live app servers were left running; browser checks used an isolated production preview.
