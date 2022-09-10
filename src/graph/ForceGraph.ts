import ForceGraph3D, {ForceGraph3DInstance} from "3d-force-graph";
import Node from "./Node";
import Link from "./Link";
import {StateChange} from "../util/State";
import Graph3dPlugin from "../main";
import Graph from "./Graph";
import {NodeGroup} from "../settings/categories/GroupSettings";
import {rgba} from "polished";

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html

export class ForceGraph {

	private instance: ForceGraph3DInstance;
	private readonly rootHtmlElement: HTMLElement;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null;

	private readonly isLocalGraph: boolean;


	constructor(rootHtmlElement: HTMLElement, isLocalGraph: boolean) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;

		this.createGraph();

		Graph3dPlugin.settingsState.onChange(this.onSettingsStateChanged);
		if (isLocalGraph) Graph3dPlugin.openFile.onChange(this.onOpenFileChanged);
	}

	private createGraph() {
		this.createInstance();
		this.createNodes();
		this.createLinks();
	}

	private createInstance() {
		const [width, height] = [this.rootHtmlElement.innerWidth, this.rootHtmlElement.innerHeight];
		this.instance = ForceGraph3D()(this.rootHtmlElement)
			.graphData(this.getGraphData())
			.nodeLabel((node: Node) => `<div class="node-label">${node.name}</div>`)
			.nodeRelSize(Graph3dPlugin.getSettings().display.nodeSize)
			.backgroundColor(rgba(0, 0, 0, 0.0))
			.width(width)
			.height(height)
	}

	private getGraphData = (): Graph => {
		if (this.isLocalGraph && Graph3dPlugin.openFile.value) {
			return Graph3dPlugin.globalGraph.clone().getLocalGraph(Graph3dPlugin.openFile.value);
		}
		else return Graph3dPlugin.globalGraph.clone();
	}

	private onOpenFileChanged = () => {
		this.instance.graphData(this.getGraphData());
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
		console.log(this.rootHtmlElement);
		const [width, height] = [this.rootHtmlElement.offsetWidth, this.rootHtmlElement.offsetHeight];
		console.log(width, height, this.rootHtmlElement.offsetWidth, this.rootHtmlElement.offsetHeight, this.rootHtmlElement.innerWidth, this.rootHtmlElement.innerHeight, this.rootHtmlElement.clientWidth, this.rootHtmlElement.clientHeight);
		// get width height with padding

		this.set_dimensions(width, height);
	}

	public set_dimensions(width: number, height: number) {
		this.instance.width(width);
		this.instance.height(height);
	}


	private createNodes = () => {
		this.instance
			.nodeColor((node: Node) => this.getNodeColor(node))
			.nodeVisibility(this.doShowNode)
			.onNodeHover(this.onNodeHover)
	}

	private getNodeColor = (node: Node): string => {
		if (this.highlightedNodes.has(node.id)) {
			// Node is highlighted
			return node === this.hoveredNode
				? Graph3dPlugin.theme.interactiveAccentHover
				: Graph3dPlugin.theme.interactiveAccent
		} else {
			let color = Graph3dPlugin.theme.textMuted;
			Graph3dPlugin.getSettings().groups.groups.forEach(group => {
				// multiple groups -> last match wins
				if (NodeGroup.matches(group.query, node)) color = group.color;
			});
			return color;
		}
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
