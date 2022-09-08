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

	getNodeById(id: string): Node | null {
		const index = this.nodeIndex.get(id);
		if (index !== undefined) {
			return this.nodes[index];
		}
		return null;
	}

	// should only return at max 1 node
	findNodeByPath(path: string): Node | undefined {
		return this.nodes.find((node) => node.path === path);
	}

	public getLocalGraph(nodeId: string): Graph {
		const node = this.findNodeByPath(nodeId);
		if (node) {
			const nodes = [node, ...node.neighbors];
			const links = node.links;
			const nodeIndex = new Map<string, number>();
			nodes.forEach((node, index) => {
				nodeIndex.set(node.id, index);
			});

			return new Graph(nodes, links, nodeIndex);
		} else {
			return new Graph([], [], new Map<string, number>());
		}
	}

	public clone(): Graph {
		const clonedStruct = structuredClone(this);
		return new Graph(clonedStruct.nodes, clonedStruct.links, clonedStruct.nodeIndex);
	}

}
