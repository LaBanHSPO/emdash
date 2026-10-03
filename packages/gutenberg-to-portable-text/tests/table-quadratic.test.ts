import { describe, expect, it } from "vitest";

import { gutenbergToPortableText } from "../src/index.js";

const block = (figure: string) =>
	`<!-- wp:table --><figure class="wp-block-table">${figure}</figure><!-- /wp:table -->`;
const tbl = (rows: string) => block(`<table>${rows}</table>`);

function convert(figure: string) {
	let n = 0;
	return gutenbergToPortableText(block(figure), { keyGenerator: () => `k${n++}` });
}

describe("core/table keeps cell content around mismatched or optional tags", () => {
	it("ignores a stray closing span tag inside a cell", () => {
		const result = convert("<table><tr><td>a</span>b</td></tr></table>");
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k3",
				rows: [
					{
						_type: "tableRow",
						_key: "k2",
						cells: [
							{
								_type: "tableCell",
								_key: "k1",
								content: [{ _type: "span", _key: "k0", text: "ab" }],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});

	it("handles an unclosed paragraph tag inside a cell", () => {
		const result = convert("<table><tr><td><p>ab</td></tr></table>");
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k3",
				rows: [
					{
						_type: "tableRow",
						_key: "k2",
						cells: [
							{
								_type: "tableCell",
								_key: "k1",
								content: [{ _type: "span", _key: "k0", text: "ab" }],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});

	it("handles li tags with no closing li inside a cell", () => {
		const result = convert("<table><tr><td><li>a<li>b</td></tr></table>");
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k4",
				rows: [
					{
						_type: "tableRow",
						_key: "k3",
						cells: [
							{
								_type: "tableCell",
								_key: "k2",
								content: [
									{ _type: "span", _key: "k0", text: "a" },
									{ _type: "span", _key: "k1", text: "b" },
								],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});

	it("handles a nested tr tag with no closing tr inside a cell", () => {
		const result = convert("<table><tr><td><tr>ab</td></tr></table>");
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k3",
				rows: [
					{
						_type: "tableRow",
						_key: "k2",
						cells: [
							{
								_type: "tableCell",
								_key: "k1",
								content: [{ _type: "span", _key: "k0", text: "ab" }],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});
});

describe("core/table preserves nested tables", () => {
	it("keeps outer-cell text around a nested table", () => {
		const result = convert(
			"<table><tr><td><strong>Outer</strong><table><tr><td>Inner</td></tr></table></td></tr></table>",
		);
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k4",
				rows: [
					{
						_type: "tableRow",
						_key: "k3",
						cells: [
							{
								_type: "tableCell",
								_key: "k2",
								content: [
									{ _type: "span", _key: "k0", text: "Outer", marks: ["strong"] },
									{ _type: "span", _key: "k1", text: "Inner" },
								],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});
});

describe("core/table preserves HTML comments inside cells", () => {
	it("keeps table and cell text when a cell contains a comment", () => {
		const result = convert("<table><tr><td><!-- note -->Visible</td></tr></table>");
		expect(result).toEqual([
			{
				_type: "table",
				_key: "k3",
				rows: [
					{
						_type: "tableRow",
						_key: "k2",
						cells: [
							{
								_type: "tableCell",
								_key: "k1",
								content: [{ _type: "span", _key: "k0", text: "Visible" }],
							},
						],
					},
				],
				hasHeaderRow: false,
			},
		]);
	});
});

describe("core/table parses unclosed tags in linear time", () => {
	it.each([
		{
			label: "unclosed tr",
			makeHtml: () => tbl("<tr><td>x</td>".repeat(20_000)),
		},
		{
			label: "unclosed td",
			makeHtml: () => tbl("<tr>" + "<td>x".repeat(20_000) + "</tr>"),
		},
		{
			label: "repeated thead",
			makeHtml: () => tbl("<thead>".repeat(20_000)),
		},
		{
			label: "repeated tbody",
			makeHtml: () => tbl("<tbody>".repeat(20_000)),
		},
		{
			label: "closing tags before rows",
			makeHtml: () => tbl("</tr>".repeat(20_000) + "<tr>".repeat(20_000)),
		},
		{
			label: "repeated th closes in td rows",
			makeHtml: () => tbl("<tr>" + "<td>x</th>".repeat(20_000) + "</tr>"),
		},
		{
			label: "repeated table open",
			makeHtml: () => block("<table>".repeat(20_000)),
		},
		{
			label: "unterminated comment",
			makeHtml: () => block("<table>" + "<!--".repeat(20_000) + "</table>"),
		},
	])("handles $label without quadratic time", ({ makeHtml }) => {
		const html = makeHtml();
		const start = process.cpuUsage();
		gutenbergToPortableText(html);
		const { user, system } = process.cpuUsage(start);
		expect((user + system) / 1000).toBeLessThan(1000);
	});

	it("still converts a well-formed large table quickly", () => {
		const html = tbl("<tr><td>x</td></tr>".repeat(20_000));
		const start = process.cpuUsage();
		const result = gutenbergToPortableText(html);
		const { user, system } = process.cpuUsage(start);
		expect(result).toHaveLength(1);
		expect((result[0] as { rows: unknown[] }).rows).toHaveLength(20_000);
		expect((user + system) / 1000).toBeLessThan(500);
	});

	it("handles deeply nested td tags in linear time", () => {
		const n = 4_000;
		const html = tbl("<tr>" + "<td>".repeat(n) + "x" + "</td>".repeat(n) + "</tr>");
		const start = process.cpuUsage();
		const result = gutenbergToPortableText(html);
		const { user, system } = process.cpuUsage(start);
		expect(result).toHaveLength(1);
		expect((user + system) / 1000).toBeLessThan(1000);
	});
});
