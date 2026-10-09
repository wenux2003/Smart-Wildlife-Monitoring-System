# Feedback and hero control polish

Removed the feedback form's preview helper text, renamed the action to Send feedback and centered the hero's down arrow. The button stays right-aligned on desktop and full width on phones. Feedback remains frontend-only with its existing truthful confirmation.

Changed-file ESLint, final Ops production build and `git diff --check` pass. No new tests were needed for these text/alignment changes. [Browser evidence](./browser-checks.json) verifies the arrow against the visible hero center, the new button label, absent helper and no horizontal overflow/runtime exceptions at 1440 × 1000 and 390 × 844.

- [Desktop hero](./hero-1440.png)
- [Phone hero](./hero-390.png)
- [Desktop feedback](./feedback-1440.png)
- [Phone feedback](./feedback-390.png)

Desktop hero and phone feedback screenshots were visually reviewed. The offscreen skip link was hidden only for cropped capture. Checks used an isolated anonymous production preview; existing app servers and database configuration were unchanged.
