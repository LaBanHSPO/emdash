---
"@emdash-cms/admin": minor
---

Redesigns the content editor as a page. The entry's title field is a large heading at the top, the `content` field's Portable Text editor sits under it without a frame, and one bar above the page holds the back link, the entry title, the save status, and **Live View**, **Preview**, and **Publish**. Distraction-free mode uses the same bar and adds **Discard changes** and **Schedule**.

- **Writing:** Enter or Down Arrow at the end of the title moves into the body, and Up Arrow on the body's first line moves back. Clicking below the last block continues writing at the end. Select All selects the text of the block holding the caret, and the whole document on a second press.
- **Toolbar:** the formatting toolbar floats above the text and stays in view while you scroll. When it doesn't fit, it scrolls sideways. Its block buttons convert blocks the same way as **Turn into** and the slash menu, and use the same names.
- **Blocks:** hovering a block shows **+** to add a block below it (Alt-click adds one above) and a handle to drag the block or open its menu: **Turn into**, **Align**, **Continue numbering** and **Restart numbering**, **Duplicate**, **Move up** and **Move down**, and **Delete**. Escape selects the block holding the caret, and the arrow keys then move between blocks. A block inserted or pasted while another is selected goes after it, and a block inserted with the caret in text goes after that block instead of splitting it.
- **Quotes and lists:** quotes hold paragraphs, and list items hold text and nested lists, as Portable Text stores them. A heading, code block, image, or other block typed, pasted, or dropped into a quote or list lands beside it, where it's saved, instead of disappearing on save. Alignment is offered only outside quotes and lists, where it's kept.
- **Slash menu:** commands are grouped, show the Markdown that creates each block, and match abbreviated searches such as `/bl` for **Bulleted list**. Headings 4 to 6 appear when you search for them.
- **Selection toolbar:** **Turn into**, link, bold, italic, underline, strikethrough, and inline code, with subscript, superscript, alignment, and **Clear formatting** under **More formatting**. Placing the caret in a link shows where it goes, with **Edit link** and **Remove link**. A link typed as a bare domain, such as `example.com`, gets `https://`, and a link the editor can't use says so.
- **Narrow screens:** when the bar is narrow, as on phones and tablets, its secondary buttons show only their icons so it stays on one row. Block handles also show on touch screens wide enough for them.

Other Portable Text fields keep the framed editor. `PortableTextEditor` adds a `variant` prop (`"boxed"` by default, or `"document"`) and an `onArrowUpAtStart` callback.
