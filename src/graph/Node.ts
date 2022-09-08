import Link from "./Link";
import {TAbstractFile, TFile} from "obsidian";

export default class Node {
	id: string;
	name: string;
	val: number; // = weight

	neighbors: Node[];
	links: Link[];

	constructor(id: string, name: string, val = 10, neighbors: Node[] = [], links: Link[] = []) {
		this.id = id;
		this.name = name;
		this.val = val;
		this.neighbors = neighbors;
		this.links = links;
	}

	static createFromFiles (files: TFile[]) : [Node[], Map<string, number>] {
		const nodeIndex = new Map<string, number>();
		return [files.map((file, index) => {
			const hashedFilepath = stringToHash(file.path);
			const node = new Node(hashedFilepath, file.name);
			nodeIndex.set(node.id, index);
			return node;
		}), nodeIndex];
	}

	addNeighbor(neighbor: Node) {
		this.neighbors.push(neighbor);
		//this.val = this.val + 1;
	}

	addLink(link: Link) {
		this.links.push(link);
	}

	public isNeighborOf(node: Node | string) {
		if (node instanceof Node) return this.neighbors.includes(node);
		else return this.neighbors.some((neighbor) => neighbor.id === node);
	}
}
export const stringToHash = (str: string): string => {
	let hash = 0, i, chr;
	if (str.length === 0) return hash.toString();
	for (i = 0; i < str.length; i++) {
		chr   = str.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash.toString();
};
