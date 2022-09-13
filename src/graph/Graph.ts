import Link from "./Link";
import Node from "./Node";
import { App } from "obsidian";

export default class Graph {
	nodes: Node[];
	links: Link[];

	private nodeIndex: Map<string, number>;
	private linkIndex: Map<string, Map<string, number>>;

	constructor(
		nodes: Node[],
		links: Link[],
		nodeIndex: Map<string, number>,
		linkIndex: Map<string, Map<string, number>>
	) {
		this.nodes = nodes;
		this.links = links;
		this.nodeIndex = nodeIndex || new Map<string, number>();
		this.linkIndex = linkIndex || new Map<string, Map<string, number>>();
	}

	getNodeById(id: string): Node | null {
		const index = this.nodeIndex.get(id);
		if (index !== undefined) {
			return this.nodes[index];
		}
		return null;
	}

	getLinkByIds(sourceNodeId: string, targetNodeId: string): Link | null {
		const sourceLinkMap = this.linkIndex.get(sourceNodeId);
		if (sourceLinkMap) {
			const index = sourceLinkMap.get(targetNodeId);
			if (index !== undefined) {
				return this.links[index];
			}
		}
		return null;
	}

	getLinksFromNode(sourceNodeId: string): Link[] {
		const sourceLinkMap = this.linkIndex.get(sourceNodeId);
		if (sourceLinkMap) {
			return Array.from(sourceLinkMap.values()).map(
				(index) => this.links[index]
			);
		}
		return [];
	}

	getLinksWithNode(nodeId: string): Link[] {
		// we need to check if the link consists of a Node instance
		// instead of just a string id,
		// because D3 will replace each string id with the real Node instance
		// once the graph is rendered
		// @ts-ignore
		if (this.links[0]?.source?.id) {
			return this.links.filter(
				// @ts-ignore
				(link) => link.source.id === nodeId || link.target.id === nodeId
			);
		} else {
			return this.links.filter(
				(link) => link.source === nodeId || link.target === nodeId
			);
		}
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

			const linkIndex = Link.createLinkIndex(links);

			return new Graph(nodes, links, nodeIndex, linkIndex);
		} else {
			return new Graph([], [], new Map(), new Map());
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
			structuredClone(this.nodeIndex),
			structuredClone(this.linkIndex)
		);
	};

	public static createFromApp = (app: App): Graph => {
		const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
			links = Link.createFromCache(
				app.metadataCache.resolvedLinks,
				nodes,
				nodeIndex
			),
			linkIndex = Link.createLinkIndex(links);
		return new Graph(nodes, links, nodeIndex, linkIndex);
	};

	public update = (app: App) => {
		const newGraph = Graph.createFromApp(app);
		this.nodes = newGraph.nodes;
		this.links = newGraph.links;
		this.nodeIndex = newGraph.nodeIndex;
	};
}
