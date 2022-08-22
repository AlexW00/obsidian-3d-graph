import {MarkdownSourceView, Notice, Plugin} from 'obsidian';
import {Graph3dView} from "./views/Graph3dView";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}


export default class Graph3dPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			this.openWorkspaceLeaf();
		});

	}

	openWorkspaceLeaf = () => {
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) {
			leaf.open(new Graph3dView(leaf, this));
		}
	}

}



