/**
 * Keyboard block selection and scoped Select All.
 *
 * Escape selects the block holding the caret, the arrow keys then move
 * between blocks, typing can't replace the selected block, and Enter goes
 * back to writing. Select All selects just the text of the block holding the
 * caret first.
 */

import { Editor } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { AllSelection, NodeSelection, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import {
	BlockSelectAll,
	BlockSelection,
	focusDocumentStart,
} from "../../src/components/editor/BlockCommands";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

let editor: Editor;
let element: HTMLDivElement;

function create(content: string, onArrowUpAtStart: (() => boolean) | null = null) {
	element = document.createElement("div");
	document.body.append(element);
	editor = new Editor({
		element,
		extensions: [StarterKit, BlockSelection.configure({ onArrowUpAtStart }), BlockSelectAll],
		content,
	});
}

function press(key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	editor.view.dom.dispatchEvent(event);
	return event;
}

function caretIn(text: string) {
	let pos = -1;
	editor.state.doc.descendants((node, nodePos) => {
		if (pos === -1 && node.isTextblock && node.textContent === text) pos = nodePos + 1;
	});
	editor.commands.setTextSelection(pos);
}

function selectedBlockText() {
	const { selection } = editor.state;
	return selection instanceof NodeSelection ? selection.node.textContent : null;
}

afterEach(() => {
	editor.destroy();
	element.remove();
});

describe("Block selection", () => {
	it("selects the block holding the caret on Escape", () => {
		create("<p>one</p><p>two</p><p>three</p>");
		caretIn("two");

		expect(press("Escape").defaultPrevented).toBe(true);

		expect(selectedBlockText()).toBe("two");
	});

	it("moves the selection between blocks with the arrow keys", () => {
		create("<p>one</p><p>two</p><p>three</p>");
		caretIn("two");
		press("Escape");

		press("ArrowDown");
		expect(selectedBlockText()).toBe("three");

		press("ArrowUp");
		press("ArrowUp");
		expect(selectedBlockText()).toBe("one");
	});

	it("doesn't let typing or dictation replace a selected block", async () => {
		create("<p>one</p><p>two</p>");
		caretIn("two");
		editor.view.focus();
		press("Escape");
		const before = editor.getJSON();

		await userEvent.keyboard("x");
		const dictation = new InputEvent("beforeinput", {
			inputType: "insertText",
			data: "y",
			bubbles: true,
			cancelable: true,
		});
		editor.view.dom.dispatchEvent(dictation);

		expect(dictation.defaultPrevented).toBe(true);
		expect(editor.getJSON()).toEqual(before);
		expect(selectedBlockText()).toBe("two");
	});

	it("goes back to writing at the end of the block on Enter", () => {
		create("<p>one</p><p>two</p>");
		caretIn("two");
		press("Escape");
		const before = editor.getJSON();

		press("Enter");

		const { selection } = editor.state;
		expect(selection).toBeInstanceOf(TextSelection);
		expect(selection.empty).toBe(true);
		expect(selection.$from.parent.textContent).toBe("two");
		expect(selection.$from.parentOffset).toBe(3);
		expect(editor.getJSON()).toEqual(before);
	});

	it("hands ArrowUp on the first line to the field above", () => {
		const onArrowUpAtStart = vi.fn(() => true);
		create("<p>one</p><p>two</p>", onArrowUpAtStart);
		editor.commands.setTextSelection(1);

		expect(press("ArrowUp").defaultPrevented).toBe(true);
		expect(onArrowUpAtStart).toHaveBeenCalledOnce();
	});
});

describe("Select All", () => {
	const selectAll = () => press("a", isMac ? { metaKey: true } : { ctrlKey: true });

	it.each([
		["a paragraph", "<p>intro</p><p>text</p><p>outro</p>"],
		["a heading", "<p>intro</p><h2>text</h2><p>outro</p>"],
		["a list item", "<ul><li><p>intro</p></li><li><p>text</p></li></ul><p>outro</p>"],
		["a quote", "<blockquote><p>intro</p><p>text</p></blockquote><p>outro</p>"],
		["a code block", "<p>intro</p><pre><code>text</code></pre><p>outro</p>"],
	])("selects the text of %s before the document", (_, content) => {
		create(content);
		caretIn("text");

		selectAll();
		const { selection } = editor.state;
		expect(selection).toBeInstanceOf(TextSelection);
		expect(editor.state.doc.textBetween(selection.from, selection.to)).toBe("text");

		selectAll();
		expect(editor.state.selection).toBeInstanceOf(AllSelection);
	});

	it("selects the whole document from an empty block", () => {
		create("<p>intro</p><p></p><p>outro</p>");
		editor.commands.setTextSelection(8);

		selectAll();

		expect(editor.state.selection).toBeInstanceOf(AllSelection);
	});

	it("selects the whole document from a selected block", () => {
		create("<p>intro</p><p>text</p>");
		caretIn("text");
		press("Escape");

		selectAll();

		expect(editor.state.selection).toBeInstanceOf(AllSelection);
	});
});

describe("focusDocumentStart", () => {
	it("puts the caret above a leading divider instead of selecting it", () => {
		create("<hr><p>after</p>");

		focusDocumentStart(editor);

		expect(editor.state.selection).toBeInstanceOf(GapCursor);
		expect(editor.state.selection.from).toBe(0);
	});

	it("puts the caret at the start of a leading paragraph", () => {
		create("<p>first</p>");

		focusDocumentStart(editor);

		expect(editor.state.selection).toBeInstanceOf(TextSelection);
		expect(editor.state.selection.from).toBe(1);
	});
});
