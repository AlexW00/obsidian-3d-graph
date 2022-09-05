import {GraphSettings} from "../settings/GraphSettings";
import {TreeItem} from "./TreeItem";
import FilterSettingsView from "./settings/FilterSettingsView";
import GroupSettingsView from "./settings/GroupSettingsView";
import DisplaySettingsView from "./settings/DisplaySettingsView";

export class GraphSettingsView extends HTMLDivElement {

	private readonly graphSettings: GraphSettings;

	constructor(graphSettings: GraphSettings) {
		super();
		this.graphSettings = graphSettings;
	}

	async connectedCallback() {
		this.classList.add("graph-controls");
		this.appendSetting(this.graphSettings.filters, "Filters", FilterSettingsView);
		// TODO: implement later this.appendSetting(this.graphSettings.groups, "Groups", GroupSettingsView);
		this.appendSetting(this.graphSettings.display, "Display", DisplaySettingsView)
	}

	private appendSetting<S>(setting: S, title: string, view: (setting: S, containerEl: HTMLElement) => void) {
		const header = document.createElement("header");
		header.classList.add("graph-control-section-header");
		header.innerHTML = title;
		const item = new TreeItem(
			header,
			[
				(containerEl: HTMLElement) => view(setting, containerEl),
			]
		)
		item.classList.add("is-collapsed");
		this.append(item);
	}

}

customElements.define("graph-settings-view", GraphSettingsView, {extends: "div"});
