import Link from "./Link";
import Node from "./Node";
import { App } from "obsidian";

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
			const links: Link[] = [];
			const nodeIndex = new Map<string, number>();

			nodes.forEach((node, index) => {
				nodeIndex.set(node.id, index);
			});

			nodes.forEach((node, index) => {
				node.links = node.links
					.filter(
						(link) =>
							nodeIndex.has(link.target) &&
							nodeIndex.has(link.source)
					)
					.map((link) => {
						if (!links.includes(link)) links.push(link);
						return link;
					});
			});

			return new Graph(nodes, links, nodeIndex);
		} else {
			return new Graph([], [], new Map<string, number>());
		}
	}

	public removeUnresolved(): void {
		this.nodes.forEach((node) => {
			node.links = node.links.filter(
				(link) =>
					this.nodeIndex.has(link.target) &&
					this.nodeIndex.has(link.source)
			);
			node.neighbors = node.neighbors.filter((neighbor) =>
				this.nodeIndex.has(neighbor.id)
			);
		});
	}

	public clone = (): Graph => {
		return new Graph(
			structuredClone(this.nodes),
			structuredClone(this.links),
			structuredClone(this.nodeIndex)
		);
	};

	public static createFromApp = (app: App): Graph => {
		const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
			links = Link.createFromCache(
				app.metadataCache.resolvedLinks,
				nodes,
				nodeIndex
			);
		return new Graph(nodes, links, nodeIndex);
	};

	public update = (app: App) => {
		const newGraph = Graph.createFromApp(app);
		this.nodes = newGraph.nodes;
		this.links = newGraph.links;
		this.nodeIndex = newGraph.nodeIndex;
	};
}
