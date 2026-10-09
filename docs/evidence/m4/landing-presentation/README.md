# Landing presentation refinements

Removed the pictured carousel helper toolbar, navigation buttons, status text, visible scrollbar, sample badges, disclosure/credits block, FAQ park-access callout and feedback rating selector. The previously removed Public reporting, protected workspaces panel remains absent. Required photo attribution now appears discreetly inside each story caption, with photographer/source and license links plus a crop notice.

## Tests

Three passing tests in `apps/ops/src/components/LandingFeedback.test.tsx` cover local feedback saving without a rating or network call, rejection of whitespace and truthful storage-failure handling. Ops typecheck, changed-file ESLint and production build pass. Main JavaScript: 249.09 kB; largest chunk: 383.37 kB; no bundle-size warning. Full workspace tests were not rerun for this follow-up.

## Browser evidence

[browser-checks.json](./browser-checks.json) records isolated anonymous production-browser checks, separately from the test source. Automatic movement advances at 32 pixels per second and reverses at the ends without jumping. Hover and keyboard focus pause it; mouse dragging remains available, and movement resumes after the mouse leaves. Phone swiping, Home/End/arrow keys, all six image loads, offscreen pause, reduced-motion behavior, absent controls/helpers and hidden scrollbar were verified. The simplified feedback form saves locally without a rating, sends zero POST requests and retains honest browser-only confirmation. No runtime exceptions or horizontal overflow at 1440 × 1000 and 390 × 844.

- [Desktop stories](./stories-1440.png)
- [Phone stories](./stories-390.png)
- [Desktop feedback](./feedback-1440.png)
- [Phone feedback](./feedback-390.png)

Desktop stories and phone feedback screenshots were visually reviewed. The offscreen skip link was hidden only for cropped capture to avoid a Chrome screenshot artifact; app behavior was unchanged.

No new dependency, API or database change was required. Existing app servers were left running. Earlier evidence folders describe historical checkpoints; this folder records the latest presentation.
