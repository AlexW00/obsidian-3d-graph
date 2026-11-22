export type LinkStyle = "lines" | "particles" | "both";

export class DisplaySettings {
	nodeSize = 3;
	linkThickness = 2;
	particleSize = 2;
	particleCount = 2; // unused since motes; kept so old settings load
	// motes of light flowing along each link, each on its own arc
	motesPerLink = 12;
	showLabels = true;
	// lines, particles flowing along each link, or both
	linkStyle: LinkStyle = "lines";
	// how far motes' arcs spread around the link (0 = all on the line)
	particleArc = 0.35;
	particleSpeed = 4;
	// 0 = soft glowing motes of light, 1 = solid dots in the notes' colors
	particleSolidity = 0;
	// notes that link to each other: how tightly each direction's stream
	// gathers around its own anchor (0 = both share the same arcs,
	// 1 = each keeps to its own side of the link)
	streamCoalescence = 0.8;
	showArrows = false;
	// like the 2D graph: labels fade out as you zoom away; higher = visible from further
	textFade = 0;

	constructor(init?: Partial<DisplaySettings>) {
		Object.entries(init ?? {}).forEach(([key, value]) => {
			if (value !== undefined && key in this)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this as any)[key] = value;
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new DisplaySettings(store ?? {});
	}

	public toObject() {
		return { ...this };
	}
}
