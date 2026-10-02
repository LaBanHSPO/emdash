import { env } from "cloudflare:workers";
import { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RawBindingD1Dialect } from "../../../cloudflare/src/db/d1-dialect.js";
import { up } from "../../src/database/migrations/077_plugin_storage_revisions.js";
import { PluginStorageRepository } from "../../src/database/repositories/plugin-storage.js";
import type { Database } from "../../src/database/types.js";
import { createLegacyPluginStorageTables } from "../utils/plugin-storage-revision-cases.js";
import { resetD1Schema } from "./d1-schema.js";

declare global {
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
		}
	}
}

let db: Kysely<Database>;

beforeAll(() => {
	db = new Kysely<Database>({ dialect: new RawBindingD1Dialect({ database: env.DB }) });
});

beforeEach(async () => {
	await resetD1Schema(db);
	await createLegacyPluginStorageTables(db);
	await up(db);
});

afterAll(async () => {
	await db.destroy();
});

describe("PluginStorageRepository batch operations on D1", () => {
	it("getMany and deleteMany accept more ids than D1's single-statement bind limit", async () => {
		const repo = new PluginStorageRepository<{ index: number }>(
			db,
			"batch-test-plugin",
			"records",
			[],
		);

		// 150 ids creates a 152-parameter query before chunking, which exceeds
		// D1's 100 bound-parameter limit.
		const items = Array.from({ length: 150 }, (_, i) => ({
			id: `record-${i.toString().padStart(4, "0")}`,
			data: { index: i },
		}));
		await repo.putMany(items);

		const ids = items.map((item) => item.id);
		const fetched = await repo.getMany(ids);

		expect(fetched.size).toBe(150);
		for (let i = 0; i < items.length; i++) {
			expect(fetched.get(items[i].id)).toEqual({ index: i });
		}

		const deleted = await repo.deleteMany(ids);
		expect(deleted).toBe(150);

		const remaining = await repo.getMany(ids);
		expect(remaining.size).toBe(0);
	});
});
