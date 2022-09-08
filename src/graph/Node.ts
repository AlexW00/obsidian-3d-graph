import Link from "./Link";
import {TFile} from "obsidian";
import hash from "../util/Hash";

export default class Node {
	id: string;
	name: string;
	path: string
	val: number; // = weight

	neighbors: Node[];
	links: Link[];

	constructor(name: string, path: string, val = 10, neighbors: Node[] = [], links: Link[] = []) {
		this.id = hash(path);
		this.name = name;
		this.path = path;
		this.val = val;
		this.neighbors = neighbors;
		this.links = links;
	}

	static createFromFiles (files: TFile[]) : [Node[], Map<string, number>] {
		const nodeMap = new Map<string, number>();
		return [files.map((file, index) => {
			const node = new Node(file.name, file.path);
			nodeMap.set(node.id, index);
			return node;
		}), nodeMap];
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
