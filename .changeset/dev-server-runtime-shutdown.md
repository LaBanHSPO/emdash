---
"emdash": patch
---

Fixes EmDash runtime and cron scheduler leaking across Astro dev server restarts.

The runtime singleton is stored on `globalThis` so it survives SSR module duplication, but it previously outlived an `astro dev` restart. The old `NodeCronScheduler` kept ticking and failed with `Vite module runner has been closed`. EmDash now registers a dev-only Vite plugin that shuts down the runtime and clears the holder when the dev server closes, so the next request builds a fresh runtime.
