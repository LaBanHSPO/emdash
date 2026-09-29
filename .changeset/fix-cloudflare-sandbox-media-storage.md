---
"@emdash-cms/cloudflare": patch
---

Fix Cloudflare sandbox `ctx.media.readBytes()` when media storage is configured

`PluginBridge.mediaReadBytes()` now looks up the media-storage download callback from a per-runner key, passed through `PluginBridgeProps`, instead of relying on a single `globalThis` symbol. This aligns media storage with the existing HTTP-fetch callback pattern and fixes "Media storage is not configured" errors for sandboxed plugins with the `media:bytes:read` capability on Cloudflare.
