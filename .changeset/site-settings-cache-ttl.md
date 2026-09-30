---
"emdash": patch
---

Fixes `getSiteSettings()` in Worker isolates returning stale values indefinitely after another isolate changed a site setting. The isolate-local cache now expires after 30 seconds, so a page rebuilt after a purge reflects writes from other isolates within one TTL instead of staying stale until the isolate is recycled.
