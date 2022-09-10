import {App, Plugin, TAbstractFile} from 'obsidian';
import {Graph3dView} from "./views/Graph3dView";
import {DEFAULT_SETTINGS, GraphSettings} from "./settings/GraphSettings";
import State from "./util/State";
import Graph from "./graph/Graph";
import {GraphFactory} from "./graph/GraphFactory";
import ObsidianTheme from "./views/ObsidianTheme";
import {NodeGroup} from "./settings/categories/GroupSettings";

// Remember to rename these classes and interfaces!


export default class Graph3dPlugin extends Plugin {
	settings: GraphSettings;

	public static settingsState: State<GraphSettings>;
	public static globalGraph: Graph;
	public static theme: ObsidianTheme;
	public static openFile: State<string | undefined> = new State(undefined);

	public static app: App;

	private unregisterStateChangeCallback: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		Graph3dPlugin.settingsState = new State<GraphSettings>(this.settings);
		Graph3dPlugin.theme = new ObsidianTheme(this.app.workspace.containerEl);
		Graph3dPlugin.app = this.app;
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
		const loadedData = await this.loadData() as GraphSettings,
			defaultSettings = DEFAULT_SETTINGS;

		if (loadedData.display) {
			Object.assign(defaultSettings.display, loadedData.display);
		}
		if (loadedData.filters) {
			Object.assign(defaultSettings.filters, loadedData.filters);
		}
		if (loadedData.groups?.groups) {
			defaultSettings.groups.groups = loadedData.groups.groups.map((groupObj) =>
				Object.assign(new NodeGroup("", ""), groupObj)
			);
		}
		this.settings =  defaultSettings;
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

	public static getSettings() : GraphSettings {
		return Graph3dPlugin.settingsState.value;
	}
}



