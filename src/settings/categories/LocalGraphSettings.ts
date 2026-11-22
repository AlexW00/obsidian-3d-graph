// Options of the local graph, as in the 2D local graph's filters
export class LocalGraphSettings {
	depth = 1;
	incomingLinks = true;
	outgoingLinks = true;
	neighborLinks = true;

	constructor(init?: Partial<LocalGraphSettings>) {
		Object.entries(init ?? {}).forEach(([key, value]) => {
			if (value !== undefined && key in this)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this as any)[key] = value;
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new LocalGraphSettings(store ?? {});
	}

	public toObject() {
		return { ...this };
	}
}
