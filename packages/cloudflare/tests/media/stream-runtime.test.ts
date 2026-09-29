import { afterEach, describe, expect, it, vi } from "vitest";

const { fakeEnv } = vi.hoisted(() => ({ fakeEnv: {} as Record<string, string | undefined> }));

vi.mock("cloudflare:workers", () => ({ env: fakeEnv }));

import type { MediaValue } from "emdash/media";

import { createMediaProvider } from "../../src/media/stream-runtime.js";

const ACCOUNT_ID = "abc12345def67890";
const HLS = "https://customer-abc12345.cloudflarestream.com/UID/manifest/video.m3u8";
const DASH = "https://customer-abc12345.cloudflarestream.com/UID/manifest/video.mpd";
const PREVIEW_URL = "https://customer-abc12345.cloudflarestream.com/UID/thumbnails/thumbnail.jpg";

const provider = createMediaProvider({ accountId: ACCOUNT_ID, apiToken: "test-token" });

/** Resolve an embed and narrow it to the video variant, which is the only one Stream returns. */
async function videoEmbed(value: MediaValue) {
	const getEmbed = provider.getEmbed;
	if (!getEmbed) throw new Error("Stream provider does not implement getEmbed");
	const result = await getEmbed(value);
	if (result.type !== "video") throw new Error(`expected a video embed, got "${result.type}"`);
	return result;
}

/**
 * A value shaped the way the media picker stores it: playback URLs under
 * `meta.playback`, poster in `previewUrl`, and no `meta.thumbnail`.
 */
function streamValue(overrides: Partial<MediaValue> = {}): MediaValue {
	return {
		id: "UID",
		provider: "cloudflare-stream",
		previewUrl: PREVIEW_URL,
		mimeType: "video/mp4",
		width: 1280,
		height: 720,
		meta: { playback: { hls: HLS, dash: DASH } },
		...overrides,
	};
}

describe("cloudflare stream getEmbed", () => {
	it("takes the poster from previewUrl, where list()/get() actually report it", async () => {
		// Regression: reading only `meta.thumbnail` dropped the poster for every
		// value the media picker produces, because neither list() nor get() set it.
		expect((await videoEmbed(streamValue())).poster).toBe(PREVIEW_URL);
	});

	it("still accepts a meta.thumbnail poster when previewUrl is absent", async () => {
		const legacy = streamValue({
			previewUrl: undefined,
			meta: { playback: { hls: HLS }, thumbnail: "https://legacy.example/thumb.jpg" },
		});
		expect((await videoEmbed(legacy)).poster).toBe("https://legacy.example/thumb.jpg");
	});
});

function thumbnailUrl(mediaProvider: ReturnType<typeof createMediaProvider>, id: string): string {
	const getThumbnailUrl = mediaProvider.getThumbnailUrl;
	if (!getThumbnailUrl) throw new Error("Stream provider does not implement getThumbnailUrl");
	return getThumbnailUrl(id);
}

describe("cloudflare stream credential resolution", () => {
	const originalAccountId = process.env.CF_ACCOUNT_ID;
	const originalApiToken = process.env.CF_STREAM_TOKEN;

	afterEach(() => {
		for (const key of Object.keys(fakeEnv)) delete fakeEnv[key];
		if (originalAccountId === undefined) delete process.env.CF_ACCOUNT_ID;
		else process.env.CF_ACCOUNT_ID = originalAccountId;
		if (originalApiToken === undefined) delete process.env.CF_STREAM_TOKEN;
		else process.env.CF_STREAM_TOKEN = originalApiToken;
	});

	it("falls back to process.env when no Workers binding is set", () => {
		process.env.CF_ACCOUNT_ID = "nodeacc1";
		process.env.CF_STREAM_TOKEN = "node-token";

		const nodeProvider = createMediaProvider({});
		expect(new URL(thumbnailUrl(nodeProvider, "video-id")).hostname).toBe(
			"customer-nodeacc1.cloudflarestream.com",
		);
	});

	it("prefers the Workers binding over process.env", () => {
		fakeEnv.CF_ACCOUNT_ID = "wrkracc1";
		process.env.CF_ACCOUNT_ID = "nodeacc1";
		process.env.CF_STREAM_TOKEN = "node-token";

		const workersProvider = createMediaProvider({});
		expect(new URL(thumbnailUrl(workersProvider, "video-id")).hostname).toBe(
			"customer-wrkracc1.cloudflarestream.com",
		);
	});

	it("prefers a direct config value over both the Workers binding and process.env", () => {
		fakeEnv.CF_ACCOUNT_ID = "wrkracc1";
		process.env.CF_ACCOUNT_ID = "nodeacc1";
		process.env.CF_STREAM_TOKEN = "node-token";

		const directProvider = createMediaProvider({ accountId: "directac" });
		expect(new URL(thumbnailUrl(directProvider, "video-id")).hostname).toBe(
			"customer-directac.cloudflarestream.com",
		);
	});

	it("throws the existing missing-variable error when neither source has the value", () => {
		expect(() => createMediaProvider({})).toThrow("Missing CF_ACCOUNT_ID");
	});
});

const PLAYER_URL = "https://customer-abc12345.cloudflarestream.com/UID/watch";

interface StreamApiVideo {
	uid: string;
	thumbnail: string;
	preview?: string;
	readyToStream: boolean;
	status: { state: string };
	size: number;
	created: string;
	modified: string;
	duration: number;
	input: { width: number; height: number };
	playback: { hls: string; dash: string };
	meta: { name: string };
}

function streamApiVideo(overrides: Partial<StreamApiVideo> = {}): StreamApiVideo {
	return {
		uid: "UID",
		thumbnail: PREVIEW_URL,
		preview: PLAYER_URL,
		readyToStream: true,
		status: { state: "ready" },
		size: 75431883,
		created: "2025-01-15T10:30:00Z",
		modified: "2025-01-15T10:30:00Z",
		duration: 41,
		input: { width: 1280, height: 720 },
		playback: { hls: HLS, dash: DASH },
		meta: { name: "webinar.mp4" },
		...overrides,
	};
}

/** Build a JSON Response like the Cloudflare Stream API returns. */
function apiSuccess(body: unknown) {
	return new Response(JSON.stringify({ success: true, result: body }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

type TestProvider = ReturnType<typeof createMediaProvider>;
type FetchMock = ReturnType<typeof vi.fn>;

/** Construct a provider with a mocked `fetch` for the duration of the test. */
function withMockedFetch<T>(fn: (provider: TestProvider, fetchMock: FetchMock) => Promise<T>) {
	return async () => {
		const fetchMock = vi.fn();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchMock;
		try {
			const testProvider = createMediaProvider({ accountId: ACCOUNT_ID, apiToken: "test-token" });
			return await fn(testProvider, fetchMock);
		} finally {
			globalThis.fetch = originalFetch;
		}
	};
}

describe("cloudflare stream playerUrl mapping", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it(
		"maps video.preview to playerUrl in list() results",
		withMockedFetch(async (mediaProvider, fetchMock) => {
			fetchMock.mockResolvedValueOnce(apiSuccess([streamApiVideo()]));

			const result = await mediaProvider.list({});

			expect(result.items[0]?.playerUrl).toBe(PLAYER_URL);
		}),
	);

	it(
		"maps video.preview to playerUrl in get() results",
		withMockedFetch(async (mediaProvider, fetchMock) => {
			fetchMock.mockResolvedValueOnce(apiSuccess(streamApiVideo()));

			if (!mediaProvider.get) throw new Error("Stream provider does not implement get");
			const item = await mediaProvider.get("UID");

			expect(item?.playerUrl).toBe(PLAYER_URL);
		}),
	);

	it(
		"maps video.preview to playerUrl in completed upload() results",
		withMockedFetch(async (mediaProvider, fetchMock) => {
			const uploadUrl = "https://upload.cloudflarestream.com/direct-upload";
			fetchMock
				.mockResolvedValueOnce(
					apiSuccess({
						uploadURL: uploadUrl,
						uid: "UID",
					}),
				)
				.mockResolvedValueOnce(new Response("OK", { status: 200 }))
				.mockResolvedValueOnce(apiSuccess(streamApiVideo()));

			if (!mediaProvider.upload) throw new Error("Stream provider does not implement upload");
			const item = await mediaProvider.upload({
				file: new File(["mp4-bytes"], "webinar.mp4", { type: "video/mp4" }),
				filename: "webinar.mp4",
			});

			expect(item.playerUrl).toBe(PLAYER_URL);
		}),
	);

	it(
		"omits playerUrl when the API response has no preview field",
		withMockedFetch(async (mediaProvider, fetchMock) => {
			fetchMock.mockResolvedValueOnce(apiSuccess([streamApiVideo({ preview: undefined })]));

			const result = await mediaProvider.list({});

			expect(result.items[0]?.playerUrl).toBeUndefined();
		}),
	);
});
