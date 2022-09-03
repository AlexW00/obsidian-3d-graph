export class FilterSettings {
	doShowOrphans? = true;

	constructor(doShowOrphans?: boolean) {
		this.doShowOrphans = doShowOrphans || this.doShowOrphans;
	}
}
