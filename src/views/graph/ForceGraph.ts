import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import Node from "../../graph/Node";
import Link from "../../graph/Link";
import { StateChange } from "../../util/State";
import Graph3dPlugin from "../../main";
import Graph from "../../graph/Graph";
import { NodeGroup } from "../../settings/categories/GroupSettings";
import { rgba } from "polished";
import EventBus from "../../util/EventBus";

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html

export class ForceGraph {
	private instance: ForceGraph3DInstance;
	private readonly rootHtmlElement: HTMLElement;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null;

	private readonly isLocalGraph: boolean;
	private graph: Graph;

	constructor(rootHtmlElement: HTMLElement, isLocalGraph: boolean) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;

		this.createGraph();

		this.initListeners();
	}

	private initListeners() {
		Graph3dPlugin.settingsState.onChange(this.onSettingsStateChanged);
		if (this.isLocalGraph)
			Graph3dPlugin.openFileState.onChange(this.refreshGraphData);
		EventBus.on("graph-changed", this.refreshGraphData);
	}

	private createGraph() {
		this.createInstance();
		this.createNodes();
		this.createLinks();
	}

	private createInstance() {
		const [width, height] = [
			this.rootHtmlElement.innerWidth,
			this.rootHtmlElement.innerHeight,
		];
		this.instance = ForceGraph3D()(this.rootHtmlElement)
			.graphData(this.getGraphData())
			.nodeLabel(
				(node: Node) => `<div class="node-label">${node.name}</div>`
			)
			.nodeRelSize(Graph3dPlugin.getSettings().display.nodeSize)
			.backgroundColor(rgba(0, 0, 0, 0.0))
			.width(width)
			.height(height);
	}

	private getGraphData = (): Graph => {
		if (this.isLocalGraph && Graph3dPlugin.openFileState.value) {
			this.graph = Graph3dPlugin.globalGraph
				.clone()
				.getLocalGraph(Graph3dPlugin.openFileState.value);
		} else {
			this.graph = Graph3dPlugin.globalGraph.clone();
		}

		return this.graph;
	};

	private refreshGraphData = () => {
		this.instance.graphData(this.getGraphData());
	};

	private onSettingsStateChanged = (data: StateChange) => {
		if (data.currentPath === "display.nodeSize") {
			this.instance.nodeRelSize(data.newValue);
		} else if (data.currentPath === "display.linkWidth") {
			this.instance.linkWidth(data.newValue);
		} else if (data.currentPath === "display.particleSize") {
			this.instance.linkDirectionalParticleWidth(
				Graph3dPlugin.getSettings().display.particleSize
			);
		}

		this.instance.refresh(); // other settings only need a refresh
	};

	public update_dimensions() {
		const [width, height] = [
			this.rootHtmlElement.offsetWidth,
			this.rootHtmlElement.offsetHeight,
		];
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
			.onNodeHover(this.onNodeHover);
	};

	private getNodeColor = (node: Node): string => {
		if (this.isHighlightedNode(node)) {
			// Node is highlighted
			return node === this.hoveredNode
				? Graph3dPlugin.theme.interactiveAccentHover
				: Graph3dPlugin.theme.interactiveAccent;
		} else {
			let color = Graph3dPlugin.theme.textMuted;
			Graph3dPlugin.getSettings().groups.groups.forEach((group) => {
				// multiple groups -> last match wins
				if (NodeGroup.matches(group.query, node)) color = group.color;
			});
			return color;
		}
	};

	private doShowNode = (node: Node) => {
		// if (this.rootFile.value) return node.isNeighborOf(this.rootFile.value) || node.id === this.rootFile.value;
		return (
			Graph3dPlugin.getSettings().filters.doShowOrphans ||
			node.links.length > 0
		);
	};

	private onNodeHover = (node: Node | null) => {
		if (
			(!node && !this.highlightedNodes.size) ||
			(node && this.hoveredNode === node)
		)
			return;

		this.clearHighlights();

		if (node) {
			this.highlightedNodes.add(node.id);
			node.neighbors.forEach((neighbor) =>
				this.highlightedNodes.add(neighbor.id)
			);
			const nodeLinks = this.graph.getLinksWithNode(node.id);

			if (nodeLinks)
				nodeLinks.forEach((link) => this.highlightedLinks.add(link));
		}
		this.hoveredNode = node || null;
		this.updateHighlight();
	};

	private isHighlightedLink = (link: Link): boolean => {
		return this.highlightedLinks.has(link);
	};

	private isHighlightedNode = (node: Node): boolean => {
		return this.highlightedNodes.has(node.id);
	};

	private createLinks = () => {
		this.instance
			.linkWidth((link: Link) =>
				this.isHighlightedLink(link)
					? Graph3dPlugin.getSettings().display.linkThickness * 1.5
					: Graph3dPlugin.getSettings().display.linkThickness
			)
			.linkDirectionalParticles((link: Link) =>
				this.isHighlightedLink(link)
					? Graph3dPlugin.getSettings().display.particleCount
					: 0
			)
			.linkDirectionalParticleWidth(
				Graph3dPlugin.getSettings().display.particleSize
			)
			.onLinkHover(this.onLinkHover)
			.linkColor((link: Link) =>
				this.isHighlightedLink(link)
					? Graph3dPlugin.theme.interactiveAccent
					: Graph3dPlugin.theme.textMuted
			);
	};

	private onLinkHover = (link: Link | null) => {
		this.clearHighlights();

		if (link) {
			this.highlightedLinks.add(link);
			this.highlightedNodes.add(link.source);
			this.highlightedNodes.add(link.target);
		}
		this.updateHighlight();
	};

	private clearHighlights = () => {
		this.highlightedNodes.clear();
		this.highlightedLinks.clear();
	};

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
