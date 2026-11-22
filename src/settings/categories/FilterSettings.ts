export class FilterSettings {
	// when on, the 2D graph's filters and color groups are used instead of the ones below
	matchCoreGraph = true;
	search = "";
	doShowOrphans = true;
	doShowAttachments = false;
	doShowTags = false;
	doShowUnresolved = false;

	constructor(init?: Partial<FilterSettings>) {
		Object.entries(init ?? {}).forEach(([key, value]) => {
			if (value !== undefined && key in this)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this as any)[key] = value;
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new FilterSettings({
			matchCoreGraph: store?.matchCoreGraph,
			search: store?.search,
			doShowOrphans: store?.doShowOrphans,
			doShowAttachments: store?.doShowAttachments,
			doShowTags: store?.doShowTags,
			doShowUnresolved: store?.doShowUnresolved,
		});
	}

	public toObject() {
		return {
			matchCoreGraph: this.matchCoreGraph,
			search: this.search,
			doShowOrphans: this.doShowOrphans,
			doShowAttachments: this.doShowAttachments,
			doShowTags: this.doShowTags,
			doShowUnresolved: this.doShowUnresolved,
		};
	}
}
