import Link from "./Link";
import {TFile} from "obsidian";

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
			const node = new Node(file.path, file.name);
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
}
