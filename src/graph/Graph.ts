import Link from "./Link";
import Node from "./Node";
import { App } from "obsidian";

export default class Graph {
	public readonly nodes: Node[];
	public readonly links: Link[];

	// Indexes to quickly retrieve nodes and links by id
	private readonly nodeIndex: Map<string, number>;
	private readonly linkIndex: Map<string, Map<string, number>>;

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

	// Returns a node by its id
	public getNodeById(id: string): Node | null {
		const index = this.nodeIndex.get(id);
		if (index !== undefined) {
			return this.nodes[index];
		}
		return null;
	}

	// Returns a link by its source and target node ids
	public getLinkByIds(
		sourceNodeId: string,
		targetNodeId: string
	): Link | null {
		const sourceLinkMap = this.linkIndex.get(sourceNodeId);
		if (sourceLinkMap) {
			const index = sourceLinkMap.get(targetNodeId);
			if (index !== undefined) {
				return this.links[index];
			}
		}
		return null;
	}

	// Returns the outgoing links of a node
	public getLinksFromNode(sourceNodeId: string): Link[] {
		const sourceLinkMap = this.linkIndex.get(sourceNodeId);
		if (sourceLinkMap) {
			return Array.from(sourceLinkMap.values()).map(
				(index) => this.links[index]
			);
		}
		return [];
	}

	// Returns the outgoing and incoming links of a node
	public getLinksWithNode(nodeId: string): Link[] {
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

	// Clones the graph
	public clone = (): Graph => {
		return new Graph(
			structuredClone(this.nodes),
			structuredClone(this.links),
			structuredClone(this.nodeIndex),
			structuredClone(this.linkIndex)
		);
	};

	// Creates a graph using the Obsidian API: files, resolved links, and
	// (like the core graph) tag nodes and nodes for links to missing notes
	public static createFromApp = (app: App): Graph => {
		const [nodes, nodeIndex] = Node.createFromFiles(app, app.vault.getFiles());
		const links: Link[] = [];
		const seen = new Map<string, Link>();

		const getOrAddNode = (id: string, create: () => Node): Node => {
			const index = nodeIndex.get(id);
			if (index !== undefined) return nodes[index];
			const node = create();
			nodeIndex.set(id, nodes.length);
			nodes.push(node);
			return node;
		};
		const connect = (source: Node, target: Node) => {
			if (source === target) return;
			const key = `${source.id}\u0000${target.id}`;
			const reverse = `${target.id}\u0000${source.id}`;
			if (seen.has(key)) return;
			const existing = seen.get(reverse);
			if (existing) {
				existing.mutual = true;
				return;
			}
			const link = source.addNeighbor(target);
			if (link) {
				seen.set(key, link);
				links.push(link);
			}
		};

		const { resolvedLinks, unresolvedLinks } = app.metadataCache;
		Object.entries(resolvedLinks).forEach(([sourcePath, targets]) => {
			const sourceIndex = nodeIndex.get(sourcePath);
			if (sourceIndex === undefined) return;
			Object.keys(targets).forEach((targetPath) => {
				const targetIndex = nodeIndex.get(targetPath);
				if (targetIndex !== undefined)
					connect(nodes[sourceIndex], nodes[targetIndex]);
			});
		});

		Object.entries(unresolvedLinks).forEach(([sourcePath, targets]) => {
			const sourceIndex = nodeIndex.get(sourcePath);
			if (sourceIndex === undefined) return;
			Object.keys(targets).forEach((linktext) => {
				const id = Node.unresolvedId(linktext);
				const target = getOrAddNode(
					id,
					() => new Node(linktext, id, false, 10, [], [], [], "unresolved")
				);
				connect(nodes[sourceIndex], target);
			});
		});

		nodes
			.filter((node) => node.kind === "note")
			.forEach((note) => {
				note.tags.forEach((tag) => {
					const id = Node.tagId(tag);
					const tagNode = getOrAddNode(
						id,
						() => new Node(`#${tag}`, id, false, 10, [], [], [tag], "tag")
					);
					connect(note, tagNode);
				});
			});

		return new Graph(nodes, links, nodeIndex, Link.createLinkIndex(links));
	};

	// A cheap fingerprint of the graph's structure, to skip no-op refreshes
	public signature(): string {
		return (
			this.nodes.map((n) => n.id).join("\n") +
			"\n--\n" +
			this.links.map((l) => `${l.source}${l.mutual ? "<>" : ">"}${l.target}`).join("\n")
		);
	}
}
