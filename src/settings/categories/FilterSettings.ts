export class FilterSettings {
	doShowOrphans? = true;
	doShowAttachments? = false;

	constructor(doShowOrphans?: boolean, doShowAttachments?: boolean) {
		this.doShowOrphans = doShowOrphans ?? this.doShowOrphans;
		this.doShowAttachments = doShowAttachments ?? this.doShowAttachments;
	}

	public static fromStore(store: any) {
		return new FilterSettings(store?.doShowOrphans, store?.doShowAttachments);
	}

	public toObject() {
		return {
			doShowOrphans: this.doShowOrphans,
			doShowAttachments: this.doShowAttachments,
		};
	}
}
