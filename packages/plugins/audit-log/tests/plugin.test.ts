import { validateBlockResponse } from "@emdash-cms/blocks/server";
import type { PluginContext } from "emdash/plugin";
import { describe, expect, it, vi } from "vitest";

import plugin from "../src/plugin.js";

interface StorageEntry {
	id: string;
	data: unknown;
}

function makeContext(
	entries: StorageEntry[] = [],
	queryResult: {
		items?: StorageEntry[];
		cursor?: string;
		hasMore?: boolean;
	} = {},
): PluginContext {
	const query = vi.fn().mockResolvedValue({
		items: queryResult.items ?? entries,
		cursor: queryResult.cursor,
		hasMore: queryResult.hasMore ?? !!queryResult.cursor,
	});

	return {
		plugin: { id: "audit-log", version: "0.0.0" },
		log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		site: { name: "Test", url: "http://localhost", locale: "en", trailingSlash: "ignore" },
		url: (path: string) => `http://localhost${path}`,
		storage: { entries: { query } },
		settings: { get: vi.fn(), set: vi.fn() },
		kv: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() },
	} as unknown as PluginContext;
}

describe("audit-log admin route", () => {
	it("returns valid Block Kit for the /history page", async () => {
		const ctx = makeContext();
		const result = await plugin.routes.admin.handler(
			{ input: { type: "page_load", page: "/history" }, request: new Request("http://localhost") },
			ctx,
		);

		const validation = validateBlockResponse(result, {});
		expect(validation.valid).toBe(true);
		expect(validation.errors).toHaveLength(0);

		const table = (result as { blocks: Array<{ type: string }> }).blocks.find(
			(b): b is { type: "table" } & Record<string, unknown> => b.type === "table",
		);
		expect(table).toBeDefined();
		expect(table?.page_action_id).toBe("load-page");
		expect(table?.empty_text).toBe("No audit entries yet");
	});

	it("passes the cursor from a load-more interaction to storage", async () => {
		const ctx = makeContext();
		await plugin.routes.admin.handler(
			{
				input: {
					type: "block_action",
					action_id: "load-page",
					value: { cursor: "abc123", sort: null },
				},
				request: new Request("http://localhost"),
			},
			ctx,
		);

		expect(ctx.storage.entries!.query).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: "abc123" }),
		);
	});

	it("includes next_cursor in the table when more entries are available", async () => {
		const entries: StorageEntry[] = [
			{
				id: "1",
				data: {
					timestamp: new Date().toISOString(),
					action: "create",
					resourceId: "post-1",
					resourceType: "content",
					collection: "posts",
				},
			},
		];
		const ctx = makeContext(entries, { cursor: "nextCursor", hasMore: true });
		const result = await plugin.routes.admin.handler(
			{ input: { type: "page_load", page: "/history" }, request: new Request("http://localhost") },
			ctx,
		);

		const table = (
			result as { blocks: Array<{ type: string } & Record<string, unknown>> }
		).blocks.find((b) => b.type === "table");
		expect(table?.next_cursor).toBe("nextCursor");
	});
});
