import { ItemView, Menu, TFile, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import Link from "../../graph/Link";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";
import Graph3dPlugin from "src/main";

export class Graph3dView extends ItemView {
	private forceGraph: ForceGraph;
	private readonly isLocalGraph: boolean;
	private readonly plugin: Graph3dPlugin;

	constructor(
		plugin: Graph3dPlugin,
		leaf: WorkspaceLeaf,
		isLocalGraph = false
	) {
		super(leaf);
		this.isLocalGraph = isLocalGraph;
		this.plugin = plugin;
	}

	onunload() {
		super.onunload();
		this.forceGraph?.destroy();
	}

	showGraph() {
		const viewContent = this.containerEl.querySelector(
			".view-content"
		) as HTMLElement;

		if (viewContent) {
			viewContent.classList.add("graph-3d-view");
			this.appendGraph(viewContent);
			const settings = new GraphSettingsView(
				this.plugin.settingsState,
				this.plugin.theme,
				{
					isLocalGraph: this.isLocalGraph,
					onAnimate: () => this.forceGraph.animate(),
				}
			);
			viewContent.appendChild(settings);
		} else {
			console.error("Could not find view content");
		}
	}

	getDisplayText(): string {
		return this.isLocalGraph ? "Local 3D graph" : "3D graph";
	}

	getViewType(): string {
		return "3d_graph_view";
	}

	getIcon(): string {
		return "glasses";
	}

	onResize() {
		super.onResize();
		this.forceGraph?.updateDimensions();
	}

	private fileFor(node: Node): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(node.path);
		return file instanceof TFile ? file : null;
	}

	private appendGraph(viewContent: HTMLElement) {
		this.forceGraph = new ForceGraph(
			this.plugin,
			viewContent,
			this.isLocalGraph
		);

		// Cmd/Ctrl + hover shows a page preview, like the 2D graph
		this.forceGraph.onHover = (node, event) => {
			if (!node || !event || node.kind === "tag") return;
			this.app.workspace.trigger("hover-link", {
				event,
				source: "3d-graph",
				hoverParent: this,
				targetEl: viewContent,
				linktext: node.kind === "unresolved" ? node.name : node.path,
				sourcePath: "",
			});
		};

		this.forceGraph
			.getInstance()
			.onNodeClick((node: Node, event: MouseEvent) => {
				const newTab = event.metaKey || event.ctrlKey;
				if (node.kind === "tag") {
					// a tag opens a search for it
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const search = (this.app as any).internalPlugins?.getPluginById?.(
						"global-search"
					)?.instance;
					search?.openGlobalSearch?.(`tag:${node.name}`);
					return;
				}
				if (node.kind === "unresolved") {
					// like the 2D graph: clicking a missing note creates it
					this.app.workspace.openLinkText(node.name, "", newTab);
					return;
				}
				const file = this.fileFor(node);
				if (!file) return;
				const leaf = newTab
					? this.app.workspace.getLeaf("tab")
					: this.isLocalGraph
					? this.app.workspace.getLeaf(false)
					: this.leaf;
				leaf.openFile(file);
			})
			.onNodeRightClick((node: Node, event: MouseEvent) => {
				const menu = new Menu();
				menu.addItem((item) =>
					item
						.setTitle("Hide in 3D graph")
						.setIcon("eye-off")
						.onClick(() => this.forceGraph.hideNode(node))
				);
				const file = this.fileFor(node);
				if (file) {
					menu.addSeparator();
					this.app.workspace.trigger("file-menu", menu, file, "graph-context-menu", this.leaf);
				}
				menu.showAtMouseEvent(event);
			})
			.onLinkRightClick((link: Link, event: MouseEvent) => {
				const menu = new Menu();
				menu.addItem((item) =>
					item
						.setTitle("Break link in 3D graph")
						.setIcon("unlink")
						.onClick(() => this.forceGraph.breakLink(link))
				);
				menu.showAtMouseEvent(event);
			});
	}
}
