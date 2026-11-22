import Node from "../../graph/Node";

export class GroupSettings {
	groups: NodeGroup[] = [];
	// color nodes by detected cluster (communities of closely linked notes)
	colorByCluster = true;
	// how many color groups to split the graph into
	clusterCount = 4;
	// how strongly a cluster's members are drawn together (0 = off)
	clusterPull = 0.4;

	constructor(
		groups?: NodeGroup[],
		colorByCluster?: boolean,
		clusterCount?: number,
		clusterPull?: number
	) {
		this.groups = groups ?? this.groups;
		this.colorByCluster = colorByCluster ?? this.colorByCluster;
		this.clusterCount = clusterCount ?? this.clusterCount;
		this.clusterPull = clusterPull ?? this.clusterPull;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new GroupSettings(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(store?.groups ?? []).flatMap((nodeGroup: any) => {
				return new NodeGroup(nodeGroup.query, nodeGroup.color);
			}),
			store?.colorByCluster,
			store?.clusterCount,
			store?.clusterPull
		);
	}

	public toObject() {
		return {
			groups: this.groups,
			colorByCluster: this.colorByCluster,
			clusterCount: this.clusterCount,
			clusterPull: this.clusterPull,
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
		// a new, still-empty group matches nothing
		if (query.trim() === "") return false;
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
