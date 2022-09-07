import Link from "./Link";
import Node from "./Node";

export default class Graph {
	nodes: Node[];
	links: Link[];

	private nodeIndex: Map<string, number>;

	constructor(nodes: Node[], links: Link[], nodeIndex: Map<string, number>) {
		console.log(nodes, links, nodeIndex);
		this.nodes = nodes;
		this.links = links;2
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

	public getLocalGraph(nodeId: string): Graph {
		const node = this.findNode(nodeId);
		if (node) {
			const nodes = [node, ...node.neighbors];
			const links = node.links;
			const nodeIndex = new Map<string, number>();
			nodes.forEach((node, index) => {
				nodeIndex.set(node.id, index);
			});

			const g = new Graph(nodes, links, nodeIndex);
			console.log("subgraph", g);
			return g;
		} else {
			console.log("empty subgraph");
			return new Graph([], [], new Map<string, number>());
		}
	}

	public clone(): Graph {
		const clonedStruct = structuredClone(this);
		return new Graph(clonedStruct.nodes, clonedStruct.links, clonedStruct.nodeIndex);
	}

}
