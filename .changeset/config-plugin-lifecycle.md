---
"emdash": patch
---

Run `plugin:install` and `plugin:activate` lifecycle hooks for native plugins registered in `astro.config.mjs`.

Previously, config-registered plugins were added to the hook pipeline but their lifecycle hooks never ran, because the boot path only created a `_plugin_state` row (and ran the hooks) from the admin install/enable/update routes. One-time setup such as `ctx.cron.schedule()` in `plugin:activate` was silently skipped, so cron tasks were never created.

On the first boot after this change, any configured native plugin with no existing `_plugin_state` row gets:

1. A persisted `_plugin_state` row with `source: "config"` and `status: "active"`.
2. `plugin:install` invoked once.
3. `plugin:activate` invoked, with full plugin context (including `ctx.cron`).

Built-in plugins and runtime-installed marketplace/registry plugins are unaffected.
