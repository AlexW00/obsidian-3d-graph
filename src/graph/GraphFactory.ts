import {App, TAbstractFile} from "obsidian";
import Graph from "./Graph";
import Link from "./Link";
import Node from "./Node";
import {ForceGraph} from "./ForceGraph";
import {GraphSettings} from "../settings/GraphSettings";
import ObsidianTheme from "../views/ObsidianTheme";
import State from "../util/State";


export abstract class GraphFactory {
	static createGraph = (app: App): Graph => {
		const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles()),
			links = Link.createFromCache(app.metadataCache.resolvedLinks, nodes, nodeIndex);
		return new Graph(nodes, links, nodeIndex);
	}

	static createForceGraph = (graph: Graph, rootHtmlElement: HTMLElement, settings: State<GraphSettings>, theme: ObsidianTheme, rootFile: State<string | undefined>) => {
		const graphContainer = document.createElement("div");
		graphContainer.style.width = "100%";
		graphContainer.style.height = "100%";
		rootHtmlElement.appendChild(graphContainer);
		return new ForceGraph(graph, graphContainer, settings, theme, rootFile);
	}
}
