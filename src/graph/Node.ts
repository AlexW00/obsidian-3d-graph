import Link from "./Link";
import { TFile } from "obsidian";

export default class Node {
	public readonly id: string;
	public readonly name: string;
	public readonly path: string;
	public readonly val: number; // = weight, currently = 1 because scaling doesn't work well

	public readonly neighbors: Node[];
	public readonly links: Link[];

	constructor(
		name: string,
		path: string,
		val = 10,
		neighbors: Node[] = [],
		links: Link[] = []
	) {
		this.id = path;
		this.name = name;
		this.path = path;
		this.val = val;
		this.neighbors = neighbors;
		this.links = links;
	}

	// Creates an array of nodes from an array of files (from the Obsidian API)
	static createFromFiles(files: TFile[]): [Node[], Map<string, number>] {
		const nodeMap = new Map<string, number>();
		return [
			files
				.map((file, index) => {
					const node = new Node(file.name, file.path);
					if (!nodeMap.has(node.id)) {
						nodeMap.set(node.id, index);
						return node;
					}
					return null;
				})
				.filter((node) => node !== null) as Node[],
			nodeMap,
		];
	}

	// Links together two nodes as neighbors (node -> neighbor)
	addNeighbor(neighbor: Node): Link | null {
		if (!this.isNeighborOf(neighbor)) {
			const link = new Link(this.id, neighbor.id);
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
