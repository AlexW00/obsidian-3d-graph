import {ItemView, WorkspaceLeaf} from "obsidian";
import {GraphFactory} from "../graph/GraphFactory";
import Node from "../graph/Node";
import ObsidianTheme from "./ObsidianTheme";
import {ForceGraph} from "../graph/ForceGraph";
import {GraphSettings} from "../settings/GraphSettings";
import State from "../util/State";
import {GraphSettingsView} from "./GraphSettingsView";

export class Graph3dView extends ItemView {

	private forceGraph: ForceGraph;
	private readonly settings: State<GraphSettings>;

	constructor(leaf: WorkspaceLeaf, settingsState: State<GraphSettings>) {
		super(leaf);
		this.settings = settingsState;
	}

	onload() {
		super.onload();
		const viewContent = this.getViewContent();

		if (viewContent) {
			viewContent.classList.add("graph-3d-view");
			this.appendGraph(viewContent);

			const settings = new GraphSettingsView(this.settings.value);
			viewContent.appendChild(settings);
		} else {
			console.error("Could not find view content");
		}
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
		const graph = GraphFactory.createGraph(this.app),
			theme = new ObsidianTheme(this.containerEl);

		this.forceGraph = GraphFactory.createForceGraph(graph, viewContent, this.settings, theme);

		this.forceGraph.getInstance().onNodeClick((node: Node, mouseEvent: MouseEvent) => {
			console.log(node, mouseEvent);
		})
	}
}
