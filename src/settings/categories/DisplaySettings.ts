export class DisplaySettings {
	nodeSize = 3;
	linkThickness = 2;
	particleSize = 2;
	// particles flowing along the hovered links
	particleCount = 2;
	showLabels = true;
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
