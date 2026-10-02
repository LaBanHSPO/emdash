import type { ImageValue, MediaValue } from "../fields/types.js";

/**
 * Convert a stored published date into a Date object.
 *
 * `getEmDashCollection()` returns `publishedAt` as a `Date`, but older data or
 * direct API consumers may pass ISO strings or numeric timestamps.
 */
export function toPublishedDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDateFormatOptions(dateFormat: string | undefined): Intl.DateTimeFormatOptions {
	if (!dateFormat) {
		return { year: "numeric", month: "long", day: "numeric" };
	}

	try {
		const parsed = JSON.parse(dateFormat);
		if (isRecord(parsed)) {
			return parsed as Intl.DateTimeFormatOptions;
		}
	} catch {
		// Fall through to the default format.
	}

	return { year: "numeric", month: "long", day: "numeric" };
}

/**
 * Format a publication date for display, honoring the site's configured
 * timezone and date format.
 */
export function formatPublishedDate(
	date: Date,
	options: { timezone?: string; dateFormat?: string } = {},
): { datetime: string; display: string } {
	const formatOptions = parseDateFormatOptions(options.dateFormat);
	if (options.timezone) {
		formatOptions.timeZone = options.timezone;
	}

	const formatter = new Intl.DateTimeFormat("en-US", formatOptions);
	return {
		datetime: date.toISOString(),
		display: formatter.format(date),
	};
}

/**
 * Prepare a thumbnail value for EmDashImage.
 *
 * Media fields are stored as objects; legacy data or direct URLs may arrive as
 * strings. Anything else is treated as absent.
 */
export function getThumbnailImage(value: unknown): ImageValue | null {
	if (!value) return null;
	if (typeof value === "string") {
		return { id: "", provider: "local", src: value } satisfies MediaValue;
	}
	if (isRecord(value)) {
		return value as unknown as ImageValue;
	}
	return null;
}
