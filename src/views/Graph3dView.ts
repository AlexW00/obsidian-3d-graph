import {ItemView, WorkspaceLeaf} from "obsidian";
import Graph3dPlugin from "../main";
import {GraphFactory} from "../graph/GraphFactory";
import Node from "../graph/Node";
import ObsidianTheme from "./ObsidianTheme";

export class Graph3dView extends ItemView {
	constructor(leaf: WorkspaceLeaf, plugin: Graph3dPlugin) {
		super(leaf);
	}

	onload() {
		super.onload();

		const graph = GraphFactory.createGraph(this.app),
			obsidianTheme = new ObsidianTheme(this.containerEl),
			graphInstance = GraphFactory.createForceGraph(graph, this.contentEl, {
			obsidianTheme
		});

		graphInstance.getInstance().onNodeClick((node: Node, mouseEvent: MouseEvent) => {
			console.log(node, mouseEvent);
		})

	}
	getDisplayText(): string {
		return "3D-Graph";
	}

	getViewType(): string {
		return "3d_graph_view";
	}
}
