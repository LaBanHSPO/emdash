import { randomUUID } from "node:crypto";

import { SqliteDialect } from "kysely";
import { describe, expect, it } from "vitest";

import { NodeSqliteCompatDatabase as Database } from "#node-sqlite";

import { EmDashRuntime, type RuntimeDependencies } from "../../../src/emdash-runtime.js";
import { definePlugin } from "../../../src/plugins/define-plugin.js";
import { PluginStateRepository } from "../../../src/plugins/state.js";

function createDeps(onInstall: () => void, onActivate: () => void): RuntimeDependencies {
	return {
		config: {
			database: {
				entrypoint: `test-config-plugin-lifecycle-${randomUUID()}`,
				config: {},
				type: "sqlite",
			},
		},
		plugins: [
			definePlugin({
				id: "config-lifecycle",
				version: "1.0.0",
				hooks: {
					"plugin:install": async () => {
						onInstall();
					},
					"plugin:activate": async (_event, ctx) => {
						onActivate();
						await ctx.cron?.schedule("daily", { schedule: "0 6 * * *" });
					},
				},
			}),
		],
		createDialect: () => new SqliteDialect({ database: new Database(":memory:") }),
		createStorage: null,
		sandboxEnabled: false,
		sandboxedPluginEntries: [],
		createSandboxRunner: null,
	};
}

describe("EmDashRuntime.create — config plugin lifecycle", () => {
	it("runs install and activate for a new config-registered plugin", async () => {
		let installRan = false;
		let activateRan = false;

		const runtime = await EmDashRuntime.create(
			createDeps(
				() => {
					installRan = true;
				},
				() => {
					activateRan = true;
				},
			),
		);

		try {
			expect(installRan).toBe(true);
			expect(activateRan).toBe(true);

			const state = await new PluginStateRepository(runtime.db).get("config-lifecycle");
			expect(state).toMatchObject({
				pluginId: "config-lifecycle",
				status: "active",
				version: "1.0.0",
				source: "config",
			});

			const task = await runtime.db
				.selectFrom("_emdash_cron_tasks")
				.select("task_name")
				.where("plugin_id", "=", "config-lifecycle")
				.executeTakeFirst();
			expect(task?.task_name).toBe("daily");
		} finally {
			await runtime.stopCron();
		}
	});
});
