import { describe, expect, it } from "vitest";

import {
	formatPublishedDate,
	getThumbnailImage,
	toPublishedDate,
} from "../../../src/widgets/recent-posts.js";

describe("toPublishedDate", () => {
	it("accepts Date objects returned by getEmDashCollection", () => {
		const date = new Date("2026-10-01T12:00:00.000Z");
		expect(toPublishedDate(date)).toEqual(date);
	});

	it("still accepts ISO date strings", () => {
		expect(toPublishedDate("2026-10-01T12:00:00.000Z")).toEqual(
			new Date("2026-10-01T12:00:00.000Z"),
		);
	});

	it("returns null for invalid, missing, and non-date values", () => {
		expect(toPublishedDate(null)).toBeNull();
		expect(toPublishedDate(undefined)).toBeNull();
		expect(toPublishedDate("")).toBeNull();
		expect(toPublishedDate("not-a-date")).toBeNull();
		expect(toPublishedDate(new Date(Number.NaN))).toBeNull();
		expect(toPublishedDate({})).toBeNull();
	});
});

describe("formatPublishedDate", () => {
	it("shifts the displayed date by the configured timezone", () => {
		const date = new Date("2026-10-01T02:00:00.000Z");

		const ahead = formatPublishedDate(date, { timezone: "Asia/Tokyo" });
		const behind = formatPublishedDate(date, { timezone: "Pacific/Pago_Pago" });

		// Tokyo is UTC+9, so 02:00 UTC is already 11:00 on Oct 1.
		expect(ahead.display).toMatch(/October\s+1/);
		// Pacific/Pago_Pago is UTC-11, so 02:00 UTC is 15:00 on Sep 30.
		expect(behind.display).toMatch(/September\s+30/);
	});

	it("uses the configured dateFormat as Intl.DateTimeFormat options", () => {
		const date = new Date("2026-10-01T12:00:00.000Z");
		const result = formatPublishedDate(date, {
			timezone: "UTC",
			dateFormat: JSON.stringify({ year: "2-digit", month: "2-digit", day: "2-digit" }),
		});

		expect(result.display).toBe("10/01/26");
	});

	it("falls back to a default long format when dateFormat is missing or invalid", () => {
		const date = new Date("2026-10-01T12:00:00.000Z");

		const noFormat = formatPublishedDate(date, { timezone: "UTC" });
		const badFormat = formatPublishedDate(date, { timezone: "UTC", dateFormat: "not-json" });

		expect(noFormat.display).toBe("October 1, 2026");
		expect(badFormat.display).toBe("October 1, 2026");
	});

	it("returns a full ISO datetime attribute and respects timezone", () => {
		const date = new Date("2026-10-01T12:00:00.000Z");
		const result = formatPublishedDate(date, { timezone: "UTC" });

		expect(result.datetime).toBe("2026-10-01T12:00:00.000Z");
	});
});

describe("getThumbnailImage", () => {
	it("returns media object values as-is so EmDashImage can render them", () => {
		const media = {
			id: "01J8K",
			provider: "local" as const,
			meta: { storageKey: "featured.jpg" },
			alt: "Featured",
		};
		expect(getThumbnailImage(media)).toBe(media);
	});

	it("normalizes a plain image URL into a local media value", () => {
		const result = getThumbnailImage("https://example.com/photo.jpg");
		expect(result).toEqual({
			id: "",
			provider: "local",
			src: "https://example.com/photo.jpg",
		});
	});

	it("returns null for missing or invalid thumbnails", () => {
		expect(getThumbnailImage(null)).toBeNull();
		expect(getThumbnailImage(undefined)).toBeNull();
		expect(getThumbnailImage(123)).toBeNull();
	});
});
