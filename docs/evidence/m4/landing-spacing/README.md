# Landing section spacing

Reduced top/bottom padding for the six main landing sections from 100 to 72 px on desktop and 65 to 48 px on phones. The join section uses 60 px on desktop and 48 px on phones, previously 75/56 px. Typography and component spacing remain unchanged. The earlier Explore the platform hero action is also absent.

## Validation and browser evidence

Ops production build and `git diff --check` pass. No bundle-size warning. No new tests were added for this CSS adjustment.

[browser-checks.json](./browser-checks.json) records measured padding for all seven sections at 1440 × 1000 and 390 × 844, no horizontal overflow, no runtime exceptions, no POST requests and the absent hero action. Desktop mission/platform and phone stories/join screenshots were visually reviewed.

- [Desktop mission/platform](./mission-platform-1440.png)
- [Phone mission/platform](./mission-platform-390.png)
- [Desktop stories/join](./stories-join-1440.png)
- [Phone stories/join](./stories-join-390.png)

Checks used an isolated anonymous production preview. The offscreen skip link was hidden only during cropped screenshot capture to avoid a Chrome capture artifact. Existing live app servers were left running. No API/database changes were made.
