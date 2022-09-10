import {App} from "obsidian";
import Graph from "./Graph";
import Link from "./Link";
import Node from "./Node";
import {ForceGraph} from "./ForceGraph";


export abstract class GraphFactory {
	static createGraph = (app: App): Graph => {
		console.log(app.vault.getFiles(), app.metadataCache.resolvedLinks);
		const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
			links = Link.createFromCache(app.metadataCache.resolvedLinks, nodes, nodeIndex);
		return new Graph(nodes, links, nodeIndex);
	}

	static createForceGraph = (rootHtmlElement: HTMLElement, isLocalGraph: boolean) => {
		return new ForceGraph(rootHtmlElement, isLocalGraph);
	}
}
