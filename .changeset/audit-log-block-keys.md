---
"@emdash-cms/plugin-audit-log": patch
---

Fixes the Audit History page failing with `INVALID_BLOCK_RESPONSE` when the plugin runs sandboxed by returning the table block with snake_case keys (`block_id`, `page_action_id`, `next_cursor`, `empty_text`) instead of camelCase.

Also fixes the "Load more" action by reading the cursor from the `{ cursor, sort }` value object the table sends, so pagination continues with the correct stored cursor.
