import {TreeItem} from "./TreeItem";
import FilterSettingsView from "./settings/FilterSettingsView";
import DisplaySettingsView from "./settings/DisplaySettingsView";
import Graph3dPlugin from "../main";
import GroupSettingsView from "./settings/GroupSettingsView";
import {FilterSettings} from "../settings/categories/FilterSettings";
import {GroupSettings} from "../settings/categories/GroupSettings";
import {DisplaySettings} from "../settings/categories/DisplaySettings";
import {ExtraButtonComponent} from "obsidian";
import State, {StateChange} from "../util/State";

export class GraphSettingsView extends HTMLDivElement {

	settingsButton: ExtraButtonComponent;
	graphControls: HTMLDivElement;

	private isCollapsedState = new State(true);

	async connectedCallback() {
		this.classList.add("graph-settings-view");

		this.settingsButton = new ExtraButtonComponent(this).setIcon("settings").setTooltip("Open graph settings").onClick(this.onSettingsButtonClicked);
		this.graphControls = this.createDiv({cls: "graph-controls"});

		this.appendGraphControlsItems(this.graphControls.createDiv({cls: "control-buttons"}));

		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.filters", FilterSettings), "Filters", FilterSettingsView);
		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.groups", GroupSettings), "Groups", GroupSettingsView);
		this.appendSetting(Graph3dPlugin.settingsState.createSubState("value.display", DisplaySettings), "Display", DisplaySettingsView)

		this.isCollapsedState.onChange(this.onIsCollapsedChanged);
		this.toggleCollapsed(this.isCollapsedState.value);
	}

	private onIsCollapsedChanged = (stateChange: StateChange) => {
		const collapsed = stateChange.newValue;
		this.toggleCollapsed(collapsed)
	}

	private toggleCollapsed(collapsed: boolean) {
		if (collapsed) {
			this.settingsButton.setDisabled(false);
			this.graphControls.classList.add("hidden");
		} else {
			this.settingsButton.setDisabled(true);
			this.graphControls.classList.remove("hidden");
		}
	}

	private onSettingsButtonClicked = () => {
		this.isCollapsedState.value = !this.isCollapsedState.value;
	}

	private appendGraphControlsItems(containerEl: HTMLElement) {
		this.appendResetButton(containerEl);
		this.appendMinimizeButton(containerEl);
	}

	private appendResetButton(containerEl: HTMLElement) {
		new ExtraButtonComponent(containerEl)
			.setIcon("eraser")
			.setTooltip("Reset to default")
			.onClick(
				() => {
					console.log("reset");
				}
			)
	}

	private appendMinimizeButton(containerEl: HTMLElement) {
		new ExtraButtonComponent(containerEl)
			.setIcon("x")
			.setTooltip("Close")
			.onClick(
				() => {
					console.log("close");
					this.isCollapsedState.value = true;
				}
			)
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
		this.graphControls.append(item);
	}

	async disconnectedCallback() {
		this.innerHTML = "";
	}

}

try { customElements.define("graph-settings-view", GraphSettingsView, {extends: "div"}); }
catch (e) { console.error(e); }
