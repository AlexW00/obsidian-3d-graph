import Link from "./Link";
import Node from "./Node";

export default class Graph {
	nodes: Node[];
	links: Link[];

	private nodeIndex: Map<string, number>;

	constructor(nodes: Node[], links: Link[], nodeIndex: Map<string, number>) {
		this.nodes = nodes;
		this.links = links;
		this.nodeIndex = nodeIndex;
	}

	findNode(id: string): Node | null {
		const index = this.nodeIndex.get(id);
		console.log(index, id);
		if (index !== undefined) {
			return this.nodes[index];
		}
		return null;
	}
}
