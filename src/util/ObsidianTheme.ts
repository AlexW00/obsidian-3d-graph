// Helper to access the current theme in TS.
// Obsidian's CSS variables are often written in terms of other variables
// (e.g. hsl(var(--accent-h), ...)), which three.js can't parse. We resolve each
// one through a probe element so every value is a plain rgb()/rgba() string.
export default class ObsidianTheme {
	backgroundPrimary: string;
	backgroundSecondary: string;
	backgroundModifierBorder: string;

	colorAccent: string;
	interactiveAccentHover: string;

	textNormal: string;
	textMuted: string;
	textFaint: string;
	textAccent: string;

	// the core graph's node colors
	graphNode: string;
	graphTag: string;
	graphAttachment: string;
	graphUnresolved: string;

	fontInterface: string;

	constructor(root: HTMLElement) {
		const probe = document.createElement("div");
		probe.style.display = "none";
		root.appendChild(probe);
		const resolve = (variable: string, fallback: string) => {
			probe.style.color = fallback;
			probe.style.color = `var(${variable}, ${fallback})`;
			return getComputedStyle(probe).color || fallback;
		};

		this.backgroundPrimary = resolve("--background-primary", "#1e1e1e");
		this.backgroundSecondary = resolve("--background-secondary", "#262626");
		this.backgroundModifierBorder = resolve(
			"--background-modifier-border",
			"#363636"
		);
		this.colorAccent = resolve("--color-accent", "#8a5cf5");
		this.interactiveAccentHover = resolve(
			"--interactive-accent-hover",
			"#a68af9"
		);
		this.textNormal = resolve("--text-normal", "#dadada");
		this.textMuted = resolve("--text-muted", "#b3b3b3");
		this.textFaint = resolve("--text-faint", "#666666");
		this.textAccent = resolve("--text-accent", "#a68af9");

		this.graphNode = resolve("--graph-node", this.textMuted);
		this.graphTag = resolve("--graph-node-tag", "#44cf6e");
		this.graphAttachment = resolve("--graph-node-attachment", "#e0de71");
		this.graphUnresolved = ObsidianTheme.withAlpha(
			resolve("--graph-node-unresolved", this.textFaint),
			0.6
		);

		probe.style.fontFamily = "var(--font-interface, sans-serif)";
		this.fontInterface = getComputedStyle(probe).fontFamily || "sans-serif";

		probe.remove();
	}

	// Returns the given rgb()/rgba() color with a new alpha
	static withAlpha(color: string, alpha: number): string {
		const hex = color.match(/^#([0-9a-f]{6})$/i);
		if (hex) {
			const v = parseInt(hex[1], 16);
			return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
		}
		const m = color.match(/rgba?\(([^)]+)\)/);
		if (!m) return color;
		const [r, g, b] = m[1].split(/[\s,/]+/).map((v) => parseFloat(v));
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	// Returns the given rgb()/rgba() color as #rrggbb (for <input type="color">)
	static toHex(color: string): string {
		const m = color.match(/rgba?\(([^)]+)\)/);
		if (!m) return color;
		return (
			"#" +
			m[1]
				.split(/[\s,/]+/)
				.slice(0, 3)
				.map((v) => Math.round(parseFloat(v)).toString(16).padStart(2, "0"))
				.join("")
		);
	}

	// Blends two rgb()/rgba() colors: t = 0 gives a, t = 1 gives b (opaque result)
	static mix(a: string, b: string, t: number): string {
		const parse = (c: string) =>
			(c.match(/rgba?\(([^)]+)\)/)?.[1] ?? "128,128,128")
				.split(/[\s,/]+/)
				.map((v) => parseFloat(v));
		const [ca, cb] = [parse(a), parse(b)];
		const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}
}
