export class GroupSettings {
	groups: NodeGroup[] = [];


	constructor(groups?: NodeGroup[]) {
		this.groups = groups || this.groups;
	}
}

export class NodeGroup {
	query: string;
	color: string;

	constructor(query: string, color: string) {
		this.query = query;
		this.color = color;
	}

}

