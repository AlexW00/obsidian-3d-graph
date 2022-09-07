import {Plugin, TAbstractFile} from 'obsidian';
import {Graph3dView} from "./views/Graph3dView";
import {DEFAULT_SETTINGS, GraphSettings} from "./settings/GraphSettings";
import State from "./util/State";
import Graph from "./graph/Graph";
import {GraphFactory} from "./graph/GraphFactory";
import ObsidianTheme from "./views/ObsidianTheme";

// Remember to rename these classes and interfaces!


export default class Graph3dPlugin extends Plugin {
	settings: GraphSettings;

	public static settingsState: State<GraphSettings>;
	public static globalGraph: Graph;
	public static theme: ObsidianTheme;
	public static openFile: State<string | undefined> = new State(undefined);

	private unregisterStateChangeCallback: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		Graph3dPlugin.settingsState = new State<GraphSettings>(this.settings);
		Graph3dPlugin.theme = new ObsidianTheme(this.app.workspace.containerEl);

		//console.log(Graph3dPlugin.settingsState.value, Graph3dPlugin.graphState.value, Graph3dPlugin.theme);

		this.unregisterStateChangeCallback = Graph3dPlugin.settingsState.onChange(() => this.saveSettings())
		this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			this.openGlobalGraph();
		});
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			if (!file) return
			menu.addItem((item) => {
				item.setTitle('Open in 3D Graph')
					.setIcon('move-3d')
					.onClick(() => {

						this.openLocalGraph(file);
					});
			});
		}));
		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			if (file) Graph3dPlugin.openFile.value = file.path;
		}));
	}

	openLocalGraph = (file: TAbstractFile) => {
		if (!Graph3dPlugin.globalGraph) Graph3dPlugin.globalGraph = GraphFactory.createGraph(this.app);

		Graph3dPlugin.openFile.value = file.path;
		console.log("Opening local graph for file: " + file.path);
		const leaf = this.app.workspace.getLeaf(true);
		leaf.open(new Graph3dView(leaf, true));
	}

	openGlobalGraph = () => {
		if (!Graph3dPlugin.globalGraph) Graph3dPlugin.globalGraph = GraphFactory.createGraph(this.app);
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) {
			leaf.open(new Graph3dView(leaf));
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		super.onunload();
		if (this.unregisterStateChangeCallback) {
			this.unregisterStateChangeCallback();
		}
	}

	public static cloneGlobalGraph() : Graph {
		// we need to copy the graph because otherwise D3 will modify the original graph
		return Graph3dPlugin.globalGraph.clone();
	}

	public static getSettings() : GraphSettings {
		return Graph3dPlugin.settingsState.value;
	}
}



