import { Button, DropdownMenu } from "@cloudflare/kumo";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { CaretDown, Check, Monitor, Moon, Sun, type Icon } from "@phosphor-icons/react";

import { useTheme } from "./ThemeProvider";

type ThemeSetting = "light" | "dark" | "system";

interface ThemeOption {
	value: ThemeSetting;
	label: MessageDescriptor;
	icon: Icon;
}

const SYSTEM_OPTION: ThemeOption = { value: "system", label: msg`System`, icon: Monitor };

const THEME_OPTIONS: ThemeOption[] = [
	{ value: "light", label: msg`Light`, icon: Sun },
	{ value: "dark", label: msg`Dark`, icon: Moon },
	SYSTEM_OPTION,
];

function isThemeSetting(value: unknown): value is ThemeSetting {
	return value === "light" || value === "dark" || value === "system";
}

export function ThemeMenu({
	className,
	iconClassName,
	labelClassName,
}: {
	className?: string;
	iconClassName?: string;
	labelClassName?: string;
}) {
	const { t } = useLingui();
	const { theme, setTheme } = useTheme();

	const current = THEME_OPTIONS.find((option) => option.value === theme) ?? SYSTEM_OPTION;
	const CurrentIcon = current.icon;
	const currentLabel = t(current.label);

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button variant="ghost" className={className} aria-label={t`Theme: ${currentLabel}`}>
						<CurrentIcon className={iconClassName} aria-hidden="true" />
						<span className={labelClassName}>{currentLabel}</span>
						<CaretDown className="size-3 shrink-0" aria-hidden="true" />
					</Button>
				}
			/>
			<DropdownMenu.Content
				align="end"
				className="w-44 origin-[var(--transform-origin)] rounded-xl p-1.5 transition-[transform,scale,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none"
			>
				<DropdownMenu.RadioGroup
					aria-label={t`Theme`}
					value={theme}
					onValueChange={(value) => {
						if (isThemeSetting(value)) setTheme(value);
					}}
				>
					{THEME_OPTIONS.map((option) => {
						const OptionIcon = option.icon;
						return (
							<DropdownMenu.RadioItem
								key={option.value}
								value={option.value}
								closeOnClick
								className="gap-2.5 py-2"
								icon={
									<OptionIcon
										className="size-4 text-kumo-subtle in-data-highlighted:text-kumo-default"
										aria-hidden="true"
									/>
								}
							>
								{t(option.label)}
								{option.value === theme && (
									<Check className="ms-auto size-4 text-kumo-default" aria-hidden="true" />
								)}
							</DropdownMenu.RadioItem>
						);
					})}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
