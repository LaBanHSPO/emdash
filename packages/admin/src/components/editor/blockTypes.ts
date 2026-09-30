/**
 * Text block types the editor can turn a block into. Shared by the block
 * menu, the selection toolbar, and the slash menu so they agree on labels
 * and icons.
 */

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import {
	CodeBlock,
	List,
	ListNumbers,
	Quotes,
	TextHFive,
	TextHFour,
	TextHOne,
	TextHSix,
	TextHThree,
	TextHTwo,
	TextT,
	type Icon,
} from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";

export type TextBlockTypeId =
	| "paragraph"
	| "heading1"
	| "heading2"
	| "heading3"
	| "heading4"
	| "heading5"
	| "heading6"
	| "bulletList"
	| "orderedList"
	| "blockquote"
	| "codeBlock";

export interface TextBlockType {
	id: TextBlockTypeId;
	label: MessageDescriptor;
	icon: Icon;
	/** Markdown that produces this block when typed at the start of a line. */
	markdown?: string;
	isActive: (editor: Editor) => boolean;
	/** Converts the selected block(s), lifting them out of lists and quotes first. */
	transform: (editor: Editor) => void;
}

const heading = (
	level: 1 | 2 | 3 | 4 | 5 | 6,
	label: MessageDescriptor,
	icon: Icon,
): TextBlockType => ({
	id: `heading${level}`,
	label,
	icon,
	markdown: "#".repeat(level),
	isActive: (editor) => editor.isActive("heading", { level }),
	transform: (editor) => {
		editor.chain().focus().clearNodes().setNode("heading", { level }).run();
	},
});

export const textBlockTypes: TextBlockType[] = [
	{
		id: "paragraph",
		label: msg`Text`,
		icon: TextT,
		isActive: (editor) => editor.isActive("paragraph"),
		transform: (editor) => {
			editor.chain().focus().clearNodes().setNode("paragraph").run();
		},
	},
	heading(1, msg`Heading 1`, TextHOne),
	heading(2, msg`Heading 2`, TextHTwo),
	heading(3, msg`Heading 3`, TextHThree),
	heading(4, msg`Heading 4`, TextHFour),
	heading(5, msg`Heading 5`, TextHFive),
	heading(6, msg`Heading 6`, TextHSix),
	{
		id: "bulletList",
		label: msg`Bulleted list`,
		icon: List,
		markdown: "-",
		isActive: (editor) => editor.isActive("bulletList"),
		transform: (editor) => {
			editor.chain().focus().clearNodes().toggleBulletList().run();
		},
	},
	{
		id: "orderedList",
		label: msg`Numbered list`,
		icon: ListNumbers,
		markdown: "1.",
		isActive: (editor) => editor.isActive("orderedList"),
		transform: (editor) => {
			editor.chain().focus().clearNodes().toggleOrderedList().run();
		},
	},
	{
		id: "blockquote",
		label: msg`Quote`,
		icon: Quotes,
		markdown: ">",
		isActive: (editor) => editor.isActive("blockquote"),
		transform: (editor) => {
			editor.chain().focus().clearNodes().toggleBlockquote().run();
		},
	},
	{
		id: "codeBlock",
		label: msg`Code`,
		icon: CodeBlock,
		markdown: "```",
		isActive: (editor) => editor.isActive("codeBlock"),
		transform: (editor) => {
			editor.chain().focus().clearNodes().toggleCodeBlock().run();
		},
	},
];

/** Headings 4 to 6 stay out of menus unless a block already uses one; the slash menu finds them by name. */
const MENU_HIDDEN_TYPES = new Set<TextBlockTypeId>(["heading4", "heading5", "heading6"]);

/** The types a Turn into menu offers for a block of the given type. */
export function turnIntoMenuTypes(activeId?: TextBlockTypeId): TextBlockType[] {
	return textBlockTypes.filter((type) => !MENU_HIDDEN_TYPES.has(type.id) || type.id === activeId);
}

const ACTIVE_ORDER: TextBlockTypeId[] = [
	"codeBlock",
	"orderedList",
	"bulletList",
	"blockquote",
	"heading1",
	"heading2",
	"heading3",
	"heading4",
	"heading5",
	"heading6",
	"paragraph",
];

/** The innermost-meaningful type of the block at the selection, e.g. a list rather than its paragraph. */
export function activeTextBlockType(editor: Editor): TextBlockType | undefined {
	for (const id of ACTIVE_ORDER) {
		const type = textBlockTypes.find((candidate) => candidate.id === id);
		if (type?.isActive(editor)) return type;
	}
	return undefined;
}

export function canTurnInto(editor: Editor): boolean {
	return (
		editor.isEditable && !editor.isActive("table") && activeTextBlockType(editor) !== undefined
	);
}
