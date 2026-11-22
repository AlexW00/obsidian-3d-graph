// Same scales as the 2D graph's Forces section
export class ForceSettings {
	centerStrength = 0.4;
	repelStrength = 12;
	linkStrength = 1;
	linkDistance = 100;

	constructor(init?: Partial<ForceSettings>) {
		Object.entries(init ?? {}).forEach(([key, value]) => {
			if (value !== undefined && key in this)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this as any)[key] = value;
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new ForceSettings(store ?? {});
	}

	public toObject() {
		return { ...this };
	}
}
