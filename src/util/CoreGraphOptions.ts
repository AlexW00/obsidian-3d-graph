import { App } from "obsidian";

// The filters and color groups of Obsidian's built-in (2D) graph
export interface CoreGraphOptions {
	search: string;
	showTags: boolean;
	showAttachments: boolean;
	hideUnresolved: boolean;
	showOrphans: boolean;
	colorGroups: { query: string; color: string }[];
	showArrow: boolean;
	centerStrength: number;
	repelStrength: number;
	linkStrength: number;
	linkDistance: number;
}

const DEFAULTS: CoreGraphOptions = {
	search: "",
	showTags: false,
	showAttachments: false,
	hideUnresolved: false,
	showOrphans: true,
	colorGroups: [],
	showArrow: false,
	centerStrength: 0.518713248970312,
	repelStrength: 10,
	linkStrength: 1,
	linkDistance: 250,
};

// graph.json stores colors as {a, rgb: 0xRRGGBB}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCssColor = (color: any): string => {
	const rgb = typeof color?.rgb === "number" ? color.rgb : 0x888888;
	const a = typeof color?.a === "number" ? color.a : 1;
	return `rgba(${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${a})`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalize = (raw: any): CoreGraphOptions => ({
	search: typeof raw?.search === "string" ? raw.search : DEFAULTS.search,
	showTags: raw?.showTags ?? DEFAULTS.showTags,
	showAttachments: raw?.showAttachments ?? DEFAULTS.showAttachments,
	hideUnresolved: raw?.hideUnresolved ?? DEFAULTS.hideUnresolved,
	showOrphans: raw?.showOrphans ?? DEFAULTS.showOrphans,
	colorGroups: Array.isArray(raw?.colorGroups)
		? raw.colorGroups.map((g: { query?: string; color?: unknown }) => ({
				query: g?.query ?? "",
				color: toCssColor(g?.color),
		  }))
		: [],
	showArrow: raw?.showArrow ?? DEFAULTS.showArrow,
	centerStrength: num(raw?.centerStrength, DEFAULTS.centerStrength),
	repelStrength: num(raw?.repelStrength, DEFAULTS.repelStrength),
	linkStrength: num(raw?.linkStrength, DEFAULTS.linkStrength),
	linkDistance: num(raw?.linkDistance, DEFAULTS.linkDistance),
});

const num = (value: unknown, fallback: number) =>
	typeof value === "number" && isFinite(value) ? value : fallback;

// Reads the core graph's current options. Prefers the live options of the
// running graph plugin (they change as you edit the 2D graph's controls) and
// falls back to the saved graph.json.
export const readCoreGraphOptions = async (app: App): Promise<CoreGraphOptions> => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const live = (app as any).internalPlugins?.getPluginById?.("graph")?.instance?.options;
	if (live && typeof live === "object") return normalize(live);
	try {
		const json = await app.vault.adapter.read(`${app.vault.configDir}/graph.json`);
		return normalize(JSON.parse(json));
	} catch {
		return { ...DEFAULTS };
	}
};
