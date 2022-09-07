import {ItemView, WorkspaceLeaf} from "obsidian";
import {GraphFactory} from "../graph/GraphFactory";
import Node from "../graph/Node";
import {ForceGraph} from "../graph/ForceGraph";
import {GraphSettingsView} from "./GraphSettingsView";

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
		//this.forceGraph = null;
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
			this.forceGraph.set_dimensions(
				this.containerEl.innerWidth,
				this.containerEl.innerHeight
			);
		}
	}

	private getViewContent () : HTMLElement | null {
		return this.containerEl.querySelector<HTMLElement>(".view-content");
	}

	private appendGraph (viewContent: HTMLElement) {
		this.forceGraph = GraphFactory.createForceGraph(viewContent, this.isLocalGraph);

		this.forceGraph.getInstance().onNodeClick((node: Node, mouseEvent: MouseEvent) => {
			const clickedNodeFile = this.app.vault
				.getFiles()
				.find((f) => f.path === node.id);

			if (clickedNodeFile) {
				if (this.isLocalGraph) {
					this.app.workspace
						.getLeaf(false)
						.openFile(clickedNodeFile);
				} else {
					this.leaf.openFile(clickedNodeFile);
				}
			}
		})
	}
}
