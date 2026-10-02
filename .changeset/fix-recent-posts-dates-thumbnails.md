---
"emdash": patch
---

Fixes the `core:recent-posts` widget so it displays publication dates and thumbnails, and honors the site's configured timezone.

Previously the widget read `publishedAt` and `featured_image` with a string-only helper, so real `Date` and media objects were ignored and the `<time>` and `<img>` branches never rendered. Dates are now read from `Date` values, formatted with `Intl.DateTimeFormat` using the site `timezone` and `dateFormat` settings, and thumbnails are rendered with `EmDashImage`.
