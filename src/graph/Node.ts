import Link from "./Link";
import { App, TFile, getAllTags } from "obsidian";

// note: a markdown file; attachment: any other file;
// tag: a #tag shown as its own node; unresolved: a link to a note that doesn't exist
export type NodeKind = "note" | "attachment" | "tag" | "unresolved";

export default class Node {
	public readonly id: string;
	public readonly name: string;
	public readonly path: string;
	public readonly kind: NodeKind;
	public readonly isAttachment: boolean;
	public readonly val: number; // = weight, currently = 1 because scaling doesn't work well

	public readonly neighbors: Node[];
	public readonly links: Link[];
	public readonly tags: string[];
	// file creation time, used by the timelapse animation (0 for tags etc.)
	public ctime = 0;

	constructor(
		name: string,
		path: string,
		isAttachment: boolean,
		val = 10,
		neighbors: Node[] = [],
		links: Link[] = [],
		tags: string[] = [],
		kind?: NodeKind
	) {
		this.id = path;
		this.name = name;
		this.path = path;
		this.kind = kind ?? (isAttachment ? "attachment" : "note");
		this.isAttachment = this.kind === "attachment";
		this.val = val;
		this.neighbors = neighbors;
		this.links = links;
		this.tags = tags;
	}

	// Tag and unresolved-link nodes use ids that can't collide with file paths
	static tagId = (tag: string) => `#${tag}`;
	static unresolvedId = (linktext: string) => `unresolved:${linktext}`;

	// Creates an array of nodes from an array of files (from the Obsidian API)
	static createFromFiles(
		app: App,
		files: TFile[]
	): [Node[], Map<string, number>] {
		const nodeMap = new Map<string, number>();
		const nodes: Node[] = [];
		files.forEach((file) => {
			if (nodeMap.has(file.path)) return;
			const node = new Node(file.name, file.path, file.extension !== "md");
			node.ctime = file.stat?.ctime ?? 0;
			const cache = app.metadataCache.getFileCache(file),
				tags = cache ? getAllTags(cache) : null;
			if (tags != null) {
				// stores tags without leading octothorpe `#` as ["tag1", "tag2", ...]
				new Set(tags.map((tag) => tag.substring(1))).forEach((tag) =>
					node.tags.push(tag)
				);
			}
			nodeMap.set(node.id, nodes.length);
			nodes.push(node);
		});
		return [nodes, nodeMap];
	}

	// Links together two nodes as neighbors (node -> neighbor)
	addNeighbor(neighbor: Node): Link | null {
		if (!this.isNeighborOf(neighbor)) {
			const link = new Link(this.id, neighbor.id, this.isAttachment || neighbor.isAttachment);
			this.neighbors.push(neighbor);
			this.addLink(link);

			neighbor.neighbors.push(this);
			neighbor.addLink(link);

			return link;
		}
		return null;
	}

	// Pushes a link to the node's links array if it doesn't already exist
	addLink(link: Link) {
		if (
			!this.links.some(
				(l) => l.source === link.source && l.target === link.target
			)
		) {
			this.links.push(link);
		}
	}

	// Whether the node is a neighbor of another node
	public isNeighborOf(node: Node | string) {
		if (node instanceof Node) return this.neighbors.includes(node);
		else return this.neighbors.some((neighbor) => neighbor.id === node);
	}
}
