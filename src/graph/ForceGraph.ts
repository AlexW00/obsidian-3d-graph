import Graph from "./Graph";
import ForceGraph3D, {ForceGraph3DInstance} from "3d-force-graph";
import Node from "./Node";
import Link from "./Link";
import ObsidianTheme from "../views/ObsidianTheme";

import * as d3 from "d3";

export class ForceGraphOptions {
	backgroundColor?: string;
	obsidianTheme: ObsidianTheme;
	linkForce? = 1;
}

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html

export class ForceGraph {

	private readonly instance: ForceGraph3DInstance;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null;

	private readonly theme: ObsidianTheme;

	constructor(graph: Graph, rootHtmlElement: HTMLElement, options: ForceGraphOptions) {
		this.theme = options.obsidianTheme;
		this.instance = ForceGraph3D()(rootHtmlElement)
			.graphData(graph)
			.nodeLabel((node: Node) => node.name)
			.nodeRelSize(4)
			.backgroundColor(options.backgroundColor ? options.backgroundColor : "#00000000")
			.height(rootHtmlElement.innerWidth)
			.width(rootHtmlElement.innerWidth)

		this.createNodes();
		this.createLinks();
	}


	private createNodes = () => {
		this.instance
			.nodeColor((node: Node) => this.highlightedNodes.has(node.id)
			? node === this.hoveredNode
				? this.theme.interactiveAccentHover
				: this.theme.interactiveAccent
			: this.theme.textMuted
		)
			.onNodeHover(this.onNodeHover)
	}

	private onNodeHover = (node: Node | null) => {
		if ((!node && !this.highlightedNodes.size) || (node && this.hoveredNode === node)) return;
		this.clearHighlights();

		if (node) {
			this.highlightedNodes.add(node.id);
			node.neighbors.forEach(neighbor => this.highlightedNodes.add(neighbor.id));
			node.links.forEach(link => this.highlightedLinks.add(link));
		}
		this.hoveredNode = node || null;
		this.updateHighlight();
	}

	private createLinks = () => {
		this.instance.linkWidth((link: Link) => this.highlightedLinks.has(link) ? 4 : 1)
			.linkDirectionalParticles((link: Link) => this.highlightedLinks.has(link) ? 4 : 0)
			.linkDirectionalParticleWidth(4)
			.onLinkHover(this.onLinkHover);
	}

	private onLinkHover = (link: Link | null) => {
		this.clearHighlights();

		if (link) {
			this.highlightedLinks.add(link);
			this.highlightedNodes.add(link.source);
			this.highlightedNodes.add(link.target);
		}
		this.updateHighlight();
	}

	private clearHighlights = () => {
		this.highlightedNodes.clear();
		this.highlightedLinks.clear();
	}

	private updateHighlight() {
		// trigger update of highlighted objects in scene
		this.instance
			.nodeColor(this.instance.nodeColor())
			.linkColor(this.instance.linkColor())
			.linkDirectionalParticles(this.instance.linkDirectionalParticles());
	}

	getInstance(): ForceGraph3DInstance {
		return this.instance;
	}
}
