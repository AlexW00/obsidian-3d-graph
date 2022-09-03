import {GraphSettings} from "../settings/GraphSettings";
import {TreeItem} from "./TreeItem";

export class GraphSettingsView extends HTMLDivElement {

	private readonly graphSettings: GraphSettings;

	constructor(graphSettings: GraphSettings) {
		super();
		this.graphSettings = graphSettings;
	}

	onload = () => {
		this.classList.add("3d-graph-settings-view");
		this.append(
			new TreeItem(
				createDiv({text: "Tree item"}),
				[
					createDiv(
						{text: "Display"}
					),
					createDiv(
						{text: "Display"}
					),
				]
		));
	}

}
