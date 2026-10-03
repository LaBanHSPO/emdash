---
"@emdash-cms/gutenberg-to-portable-text": patch
---

Fixes `core/table` so malformed or hand-edited table markup with many unclosed tags no longer causes quadratic parsing time during WordPress import.

The table transformer now scans table, thead, tbody, tr and td/th tags in a single linear pass instead of using lazy regular expressions that backtrack to the end of the input for every unmatched start tag. Well-formed tables produce identical output; pathological inputs such as thousands of unclosed `<tr>`, `<table>` or `<!--` tags now parse in milliseconds. HTML comments or `<!...>` declarations inside a cell no longer confuse tag matching, and optional end tags (e.g. unclosed `<p>`, `<li>` or `<tr>` inside a cell) are handled without dropping the table.

This is a bug fix / performance improvement.
