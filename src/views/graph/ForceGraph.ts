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
// D3.js 3D Force Graph

export class ForceGraph {
	private instance: ForceGraph3DInstance;
	private readonly rootHtmlElement: HTMLElement;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null;

	private readonly isLocalGraph: boolean;
	private graph: Graph;
	private readonly plugin: Graph3dPlugin;

	constructor(
		plugin: Graph3dPlugin,
		rootHtmlElement: HTMLElement,
		isLocalGraph: boolean
	) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;
		this.plugin = plugin;

		console.log("ForceGraph constructor", rootHtmlElement);

		this.createGraph();
		this.initListeners();
	}

	private initListeners() {
		this.plugin.settingsState.onChange(this.onSettingsStateChanged);
		if (this.isLocalGraph)
			this.plugin.openFileState.onChange(this.refreshGraphData);
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
			.nodeRelSize(this.plugin.getSettings().display.nodeSize)
			.backgroundColor(rgba(0, 0, 0, 0.0))
			.width(width)
			.height(height);
	}

	private getGraphData = (): Graph => {
		if (this.isLocalGraph && this.plugin.openFileState.value) {
			this.graph = this.plugin.globalGraph
				.clone()
				.getLocalGraph(this.plugin.openFileState.value);
			console.log(this.graph);
		} else {
			this.graph = this.plugin.globalGraph.clone();
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
				this.plugin.getSettings().display.particleSize
			);
		}

		this.instance.refresh(); // other settings only need a refresh
	};

	public updateDimensions() {
		const [width, height] = [
			this.rootHtmlElement.offsetWidth,
			this.rootHtmlElement.offsetHeight,
		];
		this.setDimensions(width, height);
	}

	public setDimensions(width: number, height: number) {
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
				? this.plugin.theme.interactiveAccentHover
				: this.plugin.theme.textAccent;
		} else {
			let color = this.plugin.theme.textMuted;
			this.plugin.getSettings().groups.groups.forEach((group) => {
				// multiple groups -> last match wins
				if (NodeGroup.matches(group.query, node)) color = group.color;
			});
			return color;
		}
	};

	private doShowNode = (node: Node) => {
		return (
			(this.plugin.getSettings().filters.doShowOrphans ||
			node.links.length > 0) &&
			(this.plugin.getSettings().filters.doShowAttachments ||
			!node.isAttachment)
		);
	};

	private doShowLink = (link: Link) => {
		return this.plugin.getSettings().filters.doShowAttachments || !link.linksAnAttachment
	}

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
		this.hoveredNode = node ?? null;
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
					? this.plugin.getSettings().display.linkThickness * 1.5
					: this.plugin.getSettings().display.linkThickness
			)
			.linkDirectionalParticles((link: Link) =>
				this.isHighlightedLink(link)
					? this.plugin.getSettings().display.particleCount
					: 0
			)
			.linkDirectionalParticleWidth(
				this.plugin.getSettings().display.particleSize
			)
			.linkVisibility(this.doShowLink)
			.onLinkHover(this.onLinkHover)
			.linkColor((link: Link) =>
				this.isHighlightedLink(link)
					? this.plugin.theme.textAccent
					: this.plugin.theme.textMuted
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
