import {TreeItem} from "./TreeItem";
import FilterSettingsView from "./settings/FilterSettingsView";
import DisplaySettingsView from "./settings/DisplaySettingsView";
import Graph3dPlugin from "../main";
import GroupSettingsView from "./settings/GroupSettingsView";
import {FilterSettings} from "../settings/categories/FilterSettings";
import {GroupSettings} from "../settings/categories/GroupSettings";
import {DisplaySettings} from "../settings/categories/DisplaySettings";

export class GraphSettingsView extends HTMLDivElement {

	async connectedCallback() {
		this.classList.add("graph-controls");
		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.filters", FilterSettings), "Filters", FilterSettingsView);
		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.groups", GroupSettings), "Groups", GroupSettingsView);
		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.display", DisplaySettings), "Display", DisplaySettingsView)
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

	async disconnectedCallback() {
		this.innerHTML = "";
	}

}

try { customElements.define("graph-settings-view", GraphSettingsView, {extends: "div"}); }
catch (e) { console.error(e); }
