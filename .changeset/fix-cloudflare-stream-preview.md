---
"@emdash-cms/admin": patch
"@emdash-cms/cloudflare": patch
"emdash": patch
---

Add an optional hosted player URL (`playerUrl`) for media provider items. Cloudflare Stream now maps `video.preview` to `playerUrl` in `list()`, `get()`, and completed `upload()` results. The admin Media Library detail panel renders a provider-hosted player iframe when `playerUrl` is present, while keeping the native `<video>` HLS/DASH and direct-file fallbacks for other providers.
