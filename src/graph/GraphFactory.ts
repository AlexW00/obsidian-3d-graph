import {App} from "obsidian";
import Graph from "./Graph";
import Link from "./Link";
import Node from "./Node";
import {ForceGraph, ForceGraphOptions} from "./ForceGraph";



export abstract class GraphFactory {
	static createGraph = (app: App): Graph => {
		const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
			links = Link.createFromCache(app.metadataCache.resolvedLinks, nodes, nodeIndex);
		return new Graph(nodes, links, nodeIndex);
	}

	static createForceGraph = (graph: Graph, rootHtmlElement: HTMLElement, options: ForceGraphOptions) => {
		return new ForceGraph(graph, rootHtmlElement, options);
	}
}
