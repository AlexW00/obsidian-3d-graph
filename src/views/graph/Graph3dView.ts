import { ItemView, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";

export class Graph3dView extends ItemView {
	private forceGraph: ForceGraph;
	private readonly isLocalGraph: boolean;

	constructor(leaf: WorkspaceLeaf, isLocalGraph = false) {
		super(leaf);
		this.isLocalGraph = isLocalGraph;
	}

	onload() {
		super.onload();
		const viewContent = this.getViewContent();

		if (viewContent) {
			viewContent.classList.add("graph-3d-view");
			this.appendGraph(viewContent);

			const settings = new GraphSettingsView();
			viewContent.appendChild(settings);
		} else {
			console.error("Could not find view content");
		}
	}

	onunload() {
		super.onunload();
		console.log("Unloading 3D Graph");
		this.forceGraph.getInstance()._destructor();
	}

	getDisplayText(): string {
		return "3D-Graph";
	}

	getViewType(): string {
		return "3d_graph_view";
	}

	onResize() {
		super.onResize();
		const viewContent = this.getViewContent();

		if (viewContent) {
			this.forceGraph.update_dimensions();
		}
	}

	private getViewContent(): HTMLElement | null {
		return this.containerEl.querySelector<HTMLElement>(".view-content");
	}

	private appendGraph(viewContent: HTMLElement) {
		this.forceGraph = new ForceGraph(viewContent, this.isLocalGraph);

		this.forceGraph
			.getInstance()
			.onNodeClick((node: Node, mouseEvent: MouseEvent) => {
				const clickedNodeFile = this.app.vault
					.getFiles()
					.find((f) => f.path === node.path);

				if (clickedNodeFile) {
					if (this.isLocalGraph) {
						this.app.workspace
							.getLeaf(false)
							.openFile(clickedNodeFile);
					} else {
						this.leaf.openFile(clickedNodeFile);
					}
				}
			});
	}
}
