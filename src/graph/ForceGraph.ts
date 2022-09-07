import ForceGraph3D, {ForceGraph3DInstance} from "3d-force-graph";
import Node from "./Node";
import Link from "./Link";
import State, {StateChange} from "../util/State";
import Graph3dPlugin from "../main";
import Graph from "./Graph";

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html

export class ForceGraph {

	private readonly instance: ForceGraph3DInstance;
	private readonly rootHtmlElement: HTMLElement;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null;

	private readonly isLocalGraph: boolean;


	constructor(rootHtmlElement: HTMLElement, isLocalGraph: boolean) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;

		const [width, height] = [this.rootHtmlElement.innerWidth, this.rootHtmlElement.innerHeight];
		this.instance = ForceGraph3D()(rootHtmlElement)
			.graphData(this.getGraphData())
			.nodeLabel((node: Node) => `<div class="node-label">${node.name}</div>`)
			.nodeRelSize(Graph3dPlugin.getSettings().display.nodeSize)
			.backgroundColor(Graph3dPlugin.theme.backgroundPrimary)
			.width(width)
			.height(height);

		this.createNodes();
		this.createLinks();
		Graph3dPlugin.settingsState.onChange(this.onSettingsStateChanged);
		Graph3dPlugin.openFile.onChange(this.onOpenFileChanged);
	}

	private getGraphData = (): Graph => {
		if (this.isLocalGraph && Graph3dPlugin.openFile.value) {
			return Graph3dPlugin.getGlobalGraph().getLocalGraph(Graph3dPlugin.openFile.value);
		}
		else return Graph3dPlugin.getGlobalGraph();
	}

	private onOpenFileChanged = () => {
		this.instance.graphData(this.getGraphData());
		this.createNodes();
		this.createLinks();
		this.instance.refresh();
	}

	private onSettingsStateChanged = (data: StateChange) => {
		console.log("ForceGraph.onStateChanged", data);
		if (data.currentPath === "display.nodeSize") {
			this.instance.nodeRelSize(data.newValue);
		} else if (data.currentPath === "display.linkWidth") {
			this.instance.linkWidth(data.newValue);
		} else if (data.currentPath === "display.particleSize") {
			this.instance.linkDirectionalParticleWidth(Graph3dPlugin.getSettings().display.particleSize)
		} else if (data.currentPath === "groups.groups") {
			// TODO
			console.log("TODO: update groups");
		}

		this.instance.refresh(); // other settings only need a refresh
	}

	public update_dimensions() {
		const [width, height] = [this.rootHtmlElement.innerWidth, this.rootHtmlElement.innerHeight];
		this.set_dimensions(width, height);
	}

	public set_dimensions(width: number, height: number) {
		this.instance.width(width);
		this.instance.height(height);
	}


	private createNodes = () => {
		this.instance
			.nodeColor((node: Node) => this.highlightedNodes.has(node.id)
			? node === this.hoveredNode
				? Graph3dPlugin.theme.interactiveAccentHover
				: Graph3dPlugin.theme.interactiveAccent
			: Graph3dPlugin.theme.textMuted
		)
			.nodeVisibility(this.doShowNode)
			.onNodeHover(this.onNodeHover)
	}

	private doShowNode = (node: Node) => {
		// if (this.rootFile.value) return node.isNeighborOf(this.rootFile.value) || node.id === this.rootFile.value;
		return Graph3dPlugin.getSettings().filters.doShowOrphans || node.links.length > 0
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
		this.instance.linkWidth((link: Link) => this.highlightedLinks.has(link) ? Graph3dPlugin.getSettings().display.linkThickness * 1.5 : Graph3dPlugin.getSettings().display.linkThickness)
			.linkDirectionalParticles((link: Link) => this.highlightedLinks.has(link) ? Graph3dPlugin.getSettings().display.particleCount : 0)
			.linkDirectionalParticleWidth(Graph3dPlugin.getSettings().display.particleSize)
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
