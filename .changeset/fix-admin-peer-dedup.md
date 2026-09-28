---
"emdash": patch
---

Fixes native plugin admin pages and widgets in `astro dev` when they use the host admin's shared providers. Shared admin peers (`@lingui/react`, `@tanstack/react-query`, `@tanstack/react-router`, `@cloudflare/kumo`, and `@lingui/core`) are now pre-bundled as separate chunks instead of being inlined into the admin package bundle, so plugin components see the same React context instances as the admin shell. This resolves `useLingui()` throwing "useLingui hook was used without I18nProvider" and `useQuery()` failing to find a query client.
