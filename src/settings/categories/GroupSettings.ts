import Node from "../../graph/Node";

export class GroupSettings {
	groups: NodeGroup[] = [];

	constructor(groups?: NodeGroup[]) {
		this.groups = groups ?? this.groups;
	}

	public static fromStore(store: any) {
		return new GroupSettings(
			store?.groups.flatMap((nodeGroup: any) => {
				return new NodeGroup(nodeGroup.query, nodeGroup.color);
			})
		)
	}

	public toObject() {
		return {
			groups: this.groups,
		};
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
		// queries tags if query begins with "tag:" or "tag:#"
		if (query.match(/^tag:#?/)) {
			return node.tags.includes(query.replace(/^tag:#?/, "")) 
		}
		return node.path.startsWith(this.sanitizeQuery(query))
	}

	static sanitizeQuery(query: string): string {
		const trimmedQuery = query.trim();
		if (trimmedQuery.startsWith("./")) return trimmedQuery.slice(1);
		else return trimmedQuery;
	}
}
