import {Plugin, TAbstractFile} from 'obsidian';
import {Graph3dView} from "./views/Graph3dView";
import {DEFAULT_SETTINGS, GraphSettings} from "./settings/GraphSettings";
import State from "./util/State";
import EventBus from "./util/EventBus";

// Remember to rename these classes and interfaces!


export default class Graph3dPlugin extends Plugin {
	settings: GraphSettings;

	private settingsState: State<GraphSettings>;

	private unregisterStateChangeCallback: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		this.settingsState = new State<GraphSettings>(this.settings);
		this.unregisterStateChangeCallback = this.settingsState.onChange(() => this.saveSettings())
		this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			this.openGlobalGraph();
		});
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			if (!file) return
			menu.addItem((item) => {
				item.setTitle('Open in 3D Graph')
					.setIcon('move-3d')
					.onClick(() => {
						// this is a button displayed in the ... menu of a file
						this.openLocalGraph(file);
					});
			});
		}));
		//this.registerEvent(this.app.workspace.on('file-open', (file) => EventBus.trigger('file-open', file)));
	}

	openLocalGraph = (file: TAbstractFile) => {
		console.log("Opening local graph for file: " + file.path);
		const leaf = this.app.workspace.getLeaf(true);
		leaf.open(new Graph3dView(leaf, this.settingsState, new State<string>(file.path)));
	}

	openGlobalGraph = () => {
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) {
			leaf.open(new Graph3dView(leaf, this.settingsState, new State<undefined>(undefined)));
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

}



