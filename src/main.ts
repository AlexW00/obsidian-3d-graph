import {Plugin} from 'obsidian';
import {Graph3dView} from "./views/Graph3dView";
import {DEFAULT_SETTINGS, GraphSettings} from "./settings/GraphSettings";
import State from "./util/State";

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
			this.openWorkspaceLeaf();
		});
	}

	openWorkspaceLeaf = () => {
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) {
			leaf.open(new Graph3dView(leaf, this.settingsState));
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



