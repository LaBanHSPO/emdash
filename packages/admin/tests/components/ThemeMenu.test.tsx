import * as React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ThemeMenu } from "../../src/components/ThemeMenu";
import { ThemeProvider } from "../../src/components/ThemeProvider";
import { render } from "../utils/render.tsx";

function TestThemeMenu({ defaultTheme = "system" as "system" | "light" | "dark" }) {
	return (
		<ThemeProvider defaultTheme={defaultTheme}>
			<ThemeMenu />
		</ThemeProvider>
	);
}

function mockSystemTheme(theme: "light" | "dark") {
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query) =>
			({
				matches: query === "(prefers-color-scheme: dark)" && theme === "dark",
				media: query,
				onchange: null,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
			}) satisfies MediaQueryList,
	);
}

describe("ThemeMenu", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
		document.documentElement.removeAttribute("data-mode");
	});

	it("shows System when there is no saved preference", async () => {
		mockSystemTheme("light");
		const screen = await render(<TestThemeMenu />);
		const button = screen.getByRole("button", { name: "Theme: System" });
		await expect.element(button).toHaveTextContent("System");
	});

	it("shows the saved preference", async () => {
		mockSystemTheme("light");
		localStorage.setItem("emdash-theme", "dark");
		const screen = await render(<TestThemeMenu />);
		await expect.element(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
	});

	it("marks the current setting in the menu", async () => {
		mockSystemTheme("light");
		const screen = await render(<TestThemeMenu />);
		await screen.getByRole("button").click();
		await expect
			.element(screen.getByRole("menuitemradio", { name: "System" }))
			.toHaveAttribute("aria-checked", "true");
		await expect
			.element(screen.getByRole("menuitemradio", { name: "Dark" }))
			.toHaveAttribute("aria-checked", "false");
	});

	it("applies and saves an explicit theme", async () => {
		mockSystemTheme("light");
		const screen = await render(<TestThemeMenu />);
		await screen.getByRole("button").click();
		await screen.getByRole("menuitemradio", { name: "Dark" }).click();
		await expect.element(document.documentElement).toHaveAttribute("data-mode", "dark");
		expect(localStorage.getItem("emdash-theme")).toBe("dark");
		await expect.element(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
	});

	it("returns to the system theme and clears the saved preference", async () => {
		mockSystemTheme("dark");
		localStorage.setItem("emdash-theme", "light");
		const screen = await render(<TestThemeMenu />);
		await screen.getByRole("button").click();
		await screen.getByRole("menuitemradio", { name: "System" }).click();
		await expect.element(document.documentElement).toHaveAttribute("data-mode", "dark");
		expect(localStorage.getItem("emdash-theme")).toBeNull();
	});
});
