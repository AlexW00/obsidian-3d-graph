import Link from "./Link";
import { TFile } from "obsidian";

export default class Node {
	id: string;
	name: string;
	path: string;
	val: number; // = weight

	neighbors: Node[];
	links: Link[];

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

	addNeighbor(neighbor: Node): Link | null {
		if (!this.isNeighborOf(neighbor)) {
			this.neighbors.push(neighbor);
			const link = new Link(this.id, neighbor.id);
			this.addLink(link);

			neighbor.addNeighbor(this);
			return link;
		}
		return null;
	}

	addLink(link: Link) {
		this.links.push(link);
	}

	public isNeighborOf(node: Node | string) {
		if (node instanceof Node) return this.neighbors.includes(node);
		else return this.neighbors.some((neighbor) => neighbor.id === node);
	}
}
