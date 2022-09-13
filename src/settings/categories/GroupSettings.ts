import Node from "../../graph/Node";

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

	static getRegex(query: string): RegExp {
		return new RegExp(query);
	}

	static matches(query: string, node: Node): boolean {
		return node.path.startsWith(this.sanitizeQuery(query));
	}

	static sanitizeQuery(query: string): string {
		const trimmedQuery = query.trim();
		if (trimmedQuery.startsWith("./")) return trimmedQuery.slice(1);
		else return trimmedQuery;
	}
}
