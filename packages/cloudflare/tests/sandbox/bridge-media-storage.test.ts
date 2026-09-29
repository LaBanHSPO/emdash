import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
	readPluginMediaBytes: vi.fn(async (_db, storage, _id, _options) => {
		if (!storage) throw new Error("Media storage is not configured");
		return {
			bytes: new Uint8Array([1]),
			filename: "fixture.bin",
			mimeType: "application/octet-stream",
			size: 1,
		};
	}),
}));

vi.mock("cloudflare:workers", () => ({
	WorkerEntrypoint: class {
		ctx: unknown;
		env: unknown;
		constructor(ctx: unknown, env: unknown) {
			this.ctx = ctx;
			this.env = env;
		}
	},
}));

vi.mock("../../src/sandbox/bridge-runtime.js", () => ({
	D1Dialect: vi.fn(),
	Kysely: vi.fn(),
	readPluginMediaBytes: runtimeMocks.readPluginMediaBytes,
}));

afterEach(async () => {
	const { setMediaStorageCallback } = await import("../../src/sandbox/bridge.js");
	setMediaStorageCallback("test-media-key", null);
	runtimeMocks.readPluginMediaBytes.mockClear();
});

describe("PluginBridge media storage", () => {
	it("reads bytes using the storage callback registered for the bridge's mediaStorageKey", async () => {
		const { setMediaStorageCallback, PluginBridge } = await import("../../src/sandbox/bridge.js");
		const storage = { download: vi.fn() };
		setMediaStorageCallback("media-storage-key-1", storage as never);

		const bridge = new PluginBridge(
			{
				props: {
					pluginId: "media-test",
					pluginVersion: "1.0.0",
					capabilities: ["media:bytes:read"],
					allowedHosts: [],
					storageCollections: [],
					mediaStorageKey: "media-storage-key-1",
				},
			} as never,
			{ DB: {} } as never,
		);

		await bridge.mediaReadBytes("media-1");

		expect(runtimeMocks.readPluginMediaBytes).toHaveBeenCalledWith(
			expect.anything(),
			storage,
			"media-1",
			{ maxBytes: undefined },
		);
	});

	it("throws when the bridge has no mediaStorageKey", async () => {
		const { setMediaStorageCallback, PluginBridge } = await import("../../src/sandbox/bridge.js");
		setMediaStorageCallback("unused-key", { download: vi.fn() } as never);

		const bridge = new PluginBridge(
			{
				props: {
					pluginId: "media-test",
					pluginVersion: "1.0.0",
					capabilities: ["media:bytes:read"],
					allowedHosts: [],
					storageCollections: [],
				},
			} as never,
			{ DB: {} } as never,
		);

		await expect(bridge.mediaReadBytes("media-1")).rejects.toThrow(
			"Media storage is not configured",
		);
		expect(runtimeMocks.readPluginMediaBytes).not.toHaveBeenCalled();
	});

	it("throws when the bridge's mediaStorageKey has no registered callback", async () => {
		const { PluginBridge } = await import("../../src/sandbox/bridge.js");

		const bridge = new PluginBridge(
			{
				props: {
					pluginId: "media-test",
					pluginVersion: "1.0.0",
					capabilities: ["media:bytes:read"],
					allowedHosts: [],
					storageCollections: [],
					mediaStorageKey: "media-storage-key-2",
				},
			} as never,
			{ DB: {} } as never,
		);

		await expect(bridge.mediaReadBytes("media-1")).rejects.toThrow(
			"Media storage is not configured",
		);
		expect(runtimeMocks.readPluginMediaBytes).not.toHaveBeenCalled();
	});
});
