/**
 * Block-level commands for the block menu, which moves the current
 * top-level block(s) up or down or duplicates them, and keyboard selection
 * of whole blocks, the way the block handle selects them.
 */

import { Extension, type Editor } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
	AllSelection,
	NodeSelection,
	Plugin,
	PluginKey,
	Selection,
	TextSelection,
	type EditorState,
	type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { SuggestionPluginKey } from "@tiptap/suggestion";

export interface BlockRange {
	from: number;
	to: number;
}

/** The top-level blocks the selection touches, or `null` for a whole-document selection. */
export function selectedBlockRange(state: EditorState): BlockRange | null {
	const { selection, doc } = state;
	if (selection instanceof NodeSelection && selection.$from.depth === 0) {
		return { from: selection.from, to: selection.to };
	}
	const { $from, $to } = selection;
	if ($from.depth === 0 || $to.depth === 0) {
		if (selection.from === 0 && selection.to === doc.content.size) return null;
		const node = doc.nodeAt(selection.from);
		return node ? { from: selection.from, to: selection.from + node.nodeSize } : null;
	}
	return { from: $from.before(1), to: $to.after(1) };
}

/**
 * Swaps the range with its neighbouring block. The neighbour moves rather
 * than the range, so node views inside the range keep their state and the
 * selection maps along with it.
 */
export function moveBlocks(
	editor: Editor,
	direction: "up" | "down",
	range = selectedBlockRange(editor.state),
): boolean {
	if (!range || !editor.isEditable) return false;
	const { state } = editor;
	const { doc } = state;
	if (direction === "up") {
		const $from = doc.resolve(range.from);
		const index = $from.index(0);
		if (index === 0) return false;
		const previous = doc.child(index - 1);
		const previousStart = range.from - previous.nodeSize;
		const tr = state.tr
			.delete(previousStart, range.from)
			.insert(range.to - previous.nodeSize, previous)
			.scrollIntoView();
		editor.view.dispatch(tr);
		return true;
	}
	const $to = doc.resolve(range.to);
	const index = $to.index(0);
	if (index >= doc.childCount) return false;
	const next = doc.child(index);
	const tr = state.tr
		.delete(range.to, range.to + next.nodeSize)
		.insert(range.from, next)
		.scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

/**
 * Where a new block goes instead of the selection: after a block selected
 * whole, which it would otherwise replace, or after the list or quote holding
 * the caret, which can only hold text. `null` means at the selection.
 */
export function blockInsertPosition(selection: Selection): number | null {
	if (selection instanceof NodeSelection && selection.$from.depth === 0) return selection.to;
	const { $from } = selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const { name } = $from.node(depth).type;
		if (name === "listItem" || name === "blockquote") return $from.after(1);
	}
	return null;
}

/**
 * Moves the caret to an empty paragraph at `blockInsertPosition`, if there is
 * one, so the block inserted next replaces that paragraph.
 */
export function prepareBlockInsert(tr: Transaction): boolean {
	const position = blockInsertPosition(tr.selection);
	if (position === null) return true;
	tr.insert(position, tr.doc.type.schema.nodes.paragraph!.create());
	tr.setSelection(TextSelection.create(tr.doc, position + 1));
	return true;
}

export function duplicateBlocks(editor: Editor, range = selectedBlockRange(editor.state)): boolean {
	if (!range || !editor.isEditable) return false;
	const { state } = editor;
	const slice = state.doc.slice(range.from, range.to);
	editor.view.dispatch(state.tr.insert(range.to, slice.content).scrollIntoView());
	return true;
}

/**
 * Tracks whether a whole block was selected from the block handle or the
 * keyboard. While it is, the arrow keys move between blocks. A click that
 * selects an image doesn't count, so the arrow keys still leave the image
 * as usual.
 */
const blockSelectionKey = new PluginKey<boolean>("emdashBlockSelection");

/** The key code browsers report for key presses an IME is handling. */
const IME_KEY_CODE = 229;
const TEXT_INPUT_TYPES = new Set(["insertText", "insertReplacementText"]);

function topLevelNodeSelection(state: EditorState): NodeSelection | null {
	const { selection } = state;
	return selection instanceof NodeSelection && selection.$from.depth === 0 ? selection : null;
}

function isBlockSelectionActive(state: EditorState): boolean {
	return blockSelectionKey.getState(state) === true;
}

/**
 * Typing, dictation, and paste can't replace a block selected whole, or a
 * selected image, divider, or embed.
 */
function isSelectedBlockProtected(state: EditorState): boolean {
	return isBlockSelectionActive(state) || topLevelNodeSelection(state)?.node.isAtom === true;
}

/** Treats an existing whole-block selection, like the block handle's, as keyboard block selection. */
export function enterBlockSelection(editor: Editor): boolean {
	return editor.commands.setMeta(blockSelectionKey, true);
}

/**
 * Puts the caret at the start of the document. When the document opens with
 * an image or divider, the caret goes above it rather than selecting it, so
 * the next key can't replace it.
 */
export function focusDocumentStart(editor: Editor): void {
	const { state, view } = editor;
	const first = Selection.atStart(state.doc);
	const selection = first instanceof NodeSelection ? new GapCursor(state.doc.resolve(0)) : first;
	view.dispatch(state.tr.setSelection(selection).scrollIntoView());
	view.focus();
}

/** Selects the top-level block at `pos` as a whole. */
function selectBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const node = state.doc.nodeAt(pos);
	if (!node || !NodeSelection.isSelectable(node)) return false;
	editor.view.dispatch(
		state.tr
			.setSelection(NodeSelection.create(state.doc, pos))
			.setMeta(blockSelectionKey, true)
			.scrollIntoView(),
	);
	return true;
}

/** Selects the block around the caret, or does nothing if the selection spans several blocks. */
function selectCurrentBlock(editor: Editor): boolean {
	const { state } = editor;
	const { selection } = state;
	if (selection instanceof AllSelection) return false;
	if (topLevelNodeSelection(state)) {
		return !isBlockSelectionActive(state) && enterBlockSelection(editor);
	}
	const { $from, $to } = selection;
	if ($from.depth === 0 || $to.depth === 0 || $from.before(1) !== $to.before(1)) return false;
	return selectBlock(editor, $from.before(1));
}

function selectNeighbourBlock(editor: Editor, direction: -1 | 1): boolean {
	const { state } = editor;
	const selection = topLevelNodeSelection(state);
	if (!selection) return false;
	const { doc } = state;
	const index = selection.$from.index(0) + direction;
	if (index < 0 || index >= doc.childCount) return true;
	let pos = 0;
	for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
	selectBlock(editor, pos);
	return true;
}

/** Puts the caret in a new empty paragraph after the selected block. */
function moveAfterSelectedBlock(view: EditorView): void {
	const { tr } = view.state;
	prepareBlockInsert(tr);
	view.dispatch(tr.scrollIntoView());
}

/** Enter on a selected block goes back to writing at the end of it. */
function editSelectedBlock(editor: Editor): boolean {
	const { state } = editor;
	const selection = topLevelNodeSelection(state);
	if (!selection || selection.node.isAtom) return false;
	const end = TextSelection.findFrom(state.doc.resolve(selection.to), -1, true);
	if (!end || end.from < selection.from) return false;
	editor.view.dispatch(state.tr.setSelection(end).scrollIntoView());
	return true;
}

/**
 * Select All first selects just the text of the block holding the caret,
 * like Notion, so it can be copied or cleared on its own. Pressing it again
 * selects the whole document.
 */
function selectTextblockText(editor: Editor): boolean {
	const { state } = editor;
	const { selection } = state;
	if (!(selection instanceof TextSelection)) return false;
	const { $from, $to } = selection;
	if (!$from.sameParent($to) || !$from.parent.isTextblock) return false;
	const start = $from.start();
	const end = $from.end();
	if (start === end || (selection.from === start && selection.to === end)) return false;
	editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, end)));
	return true;
}

/** A menu or popover opened from the editor's controls takes Escape first. */
function hasOpenPopup(view: EditorView): boolean {
	const root = view.dom.closest("[data-emdash-editor-floating-root]");
	return root?.querySelector('[aria-expanded="true"]') != null;
}

function isAtDocumentStart(view: EditorView): boolean {
	const { selection, doc } = view.state;
	if (selection instanceof GapCursor) return selection.from === 0;
	if (!(selection instanceof TextSelection) || !selection.empty) return false;
	const first = Selection.atStart(doc);
	return first.$from.parent === selection.$from.parent && view.endOfTextblock("up");
}

function selectedBlockDecorations(doc: ProseMirrorNode): DecorationSet {
	const decorations: Decoration[] = [];
	doc.forEach((node, offset) => {
		decorations.push(
			Decoration.node(offset, offset + node.nodeSize, { class: "emdash-block-selected" }),
		);
	});
	return DecorationSet.create(doc, decorations);
}

export interface BlockSelectionOptions {
	/** Called when ArrowUp leaves the first line of the document. Return `true` if it moved focus. */
	onArrowUpAtStart: (() => boolean) | null;
}

export const BlockSelection = Extension.create<BlockSelectionOptions>({
	name: "emdashBlockSelection",
	// Ahead of TipTap's Enter, which would add a paragraph beside a selected block.
	priority: 1000,

	addOptions() {
		return { onArrowUpAtStart: null };
	},

	addProseMirrorPlugins() {
		const { editor, options } = this;
		return [
			new Plugin<boolean>({
				key: blockSelectionKey,
				state: {
					init: () => false,
					apply: (tr, active, _oldState, newState) => {
						if (!topLevelNodeSelection(newState)) return false;
						const meta: unknown = tr.getMeta(blockSelectionKey);
						if (typeof meta === "boolean") return meta;
						return tr.selectionSet ? false : active;
					},
				},
				props: {
					handleKeyDown: (view, event) => {
						if (event.defaultPrevented || !editor.isEditable) return false;
						const blockMode = isBlockSelectionActive(view.state);
						if (event.isComposing || event.keyCode === IME_KEY_CODE) {
							// An IME can't be stopped, so it writes at the end of the block, or after it, instead.
							if (isSelectedBlockProtected(view.state) && !editSelectedBlock(editor)) {
								moveAfterSelectedBlock(view);
							}
							return false;
						}
						if (SuggestionPluginKey.getState(view.state)?.active) return false;
						const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
						if (!plain) return false;
						switch (event.key) {
							case "Escape":
								return !hasOpenPopup(view) && selectCurrentBlock(editor);
							case "ArrowUp":
								if (blockMode) return selectNeighbourBlock(editor, -1);
								return isAtDocumentStart(view) && (options.onArrowUpAtStart?.() ?? false);
							case "ArrowDown":
								return blockMode && selectNeighbourBlock(editor, 1);
							case "Enter":
								return blockMode && editSelectedBlock(editor);
							default:
								return false;
						}
					},
					handleTextInput: (view) => isSelectedBlockProtected(view.state),
					// The pasted content goes after the selected block instead.
					handlePaste: (view) => {
						if (isSelectedBlockProtected(view.state)) moveAfterSelectedBlock(view);
						return false;
					},
					handleDOMEvents: {
						// Dictation, emoji pickers, and autocorrect insert text without a key press.
						beforeinput: (view, event) => {
							if (!isSelectedBlockProtected(view.state) || !TEXT_INPUT_TYPES.has(event.inputType)) {
								return false;
							}
							event.preventDefault();
							return true;
						},
					},
					decorations: (state) =>
						state.selection instanceof AllSelection ? selectedBlockDecorations(state.doc) : null,
					attributes: (state): Record<string, string> =>
						state.selection instanceof AllSelection ? { "data-emdash-block-selection": "all" } : {},
				},
			}),
		];
	},
});

/**
 * Select All scoped to the block holding the caret. Runs ahead of TipTap's
 * own Select All, which takes over on the second press.
 */
export const BlockSelectAll = Extension.create({
	name: "emdashBlockSelectAll",
	priority: 1000,

	addKeyboardShortcuts() {
		return {
			"Mod-a": () => selectTextblockText(this.editor),
		};
	},
});
