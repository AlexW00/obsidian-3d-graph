import { TreeItem } from "../atomics/TreeItem";
import DisplaySettingsView from "./categories/DisplaySettingsView";
import Graph3dPlugin from "../../main";
import { FilterSettings } from "../../settings/categories/FilterSettings";
import { GroupSettings } from "../../settings/categories/GroupSettings";
import { DisplaySettings } from "../../settings/categories/DisplaySettings";
import { ExtraButtonComponent } from "obsidian";
import State, { StateChange } from "../../util/State";
import EventBus from "../../util/EventBus";
import GroupSettingsView from "./categories/GroupSettingsView";
import FilterSettingsView from "./categories/FilterSettingsView";

export class GraphSettingsView extends HTMLDivElement {
	settingsButton: ExtraButtonComponent;
	graphControls: HTMLDivElement;

	private isCollapsedState = new State(true);

	private callbackUnregisterHandles: (() => void)[] = [];

	async connectedCallback() {
		this.classList.add("graph-settings-view");

		this.settingsButton = new ExtraButtonComponent(this)
			.setIcon("settings")
			.setTooltip("Open graph settings")
			.onClick(this.onSettingsButtonClicked);

		this.graphControls = this.createDiv({ cls: "graph-controls" });

		this.appendGraphControlsItems(
			this.graphControls.createDiv({ cls: "control-buttons" })
		);

		this.appendSetting(
			Graph3dPlugin.settingsState.createSubState(
				"value.filters",
				FilterSettings
			),
			"Filters",
			FilterSettingsView
		);
		this.appendSetting(
			Graph3dPlugin.settingsState.createSubState(
				"value.groups",
				GroupSettings
			),
			"Groups",
			GroupSettingsView
		);
		this.appendSetting(
			Graph3dPlugin.settingsState.createSubState(
				"value.display",
				DisplaySettings
			),
			"Display",
			DisplaySettingsView
		);
		this.initListeners();
		this.toggleCollapsed(this.isCollapsedState.value);
	}

	private initListeners() {
		EventBus.on("did-reset-settings", () => {
			// Re append all settings
			this.disconnectedCallback();
			this.connectedCallback();
		});
		this.callbackUnregisterHandles.push(
			this.isCollapsedState.onChange(this.onIsCollapsedChanged)
		);
	}

	// clicked to collapse/expand
	private onIsCollapsedChanged = (stateChange: StateChange) => {
		const collapsed = stateChange.newValue;
		this.toggleCollapsed(collapsed);
	};

	// toggle the view to collapsed or expanded
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
	};

	private appendGraphControlsItems(containerEl: HTMLElement) {
		this.appendResetButton(containerEl);
		this.appendMinimizeButton(containerEl);
	}

	private appendResetButton(containerEl: HTMLElement) {
		new ExtraButtonComponent(containerEl)
			.setIcon("eraser")
			.setTooltip("Reset to default")
			.onClick(() => EventBus.trigger("do-reset-settings"));
	}

	private appendMinimizeButton(containerEl: HTMLElement) {
		new ExtraButtonComponent(containerEl)
			.setIcon("x")
			.setTooltip("Close")
			.onClick(() => (this.isCollapsedState.value = true));
	}

	// utility function to append a setting
	private appendSetting<S>(
		setting: S,
		title: string,
		view: (setting: S, containerEl: HTMLElement) => void
	) {
		const header = document.createElement("header");
		header.classList.add("graph-control-section-header");
		header.innerHTML = title;
		const item = new TreeItem(header, [
			(containerEl: HTMLElement) => view(setting, containerEl),
		]);
		item.classList.add("is-collapsed");
		this.graphControls.append(item);
	}

	async disconnectedCallback() {
		this.empty();
		this.callbackUnregisterHandles.forEach((handle) => handle());
	}
}

try {
	if (customElements.get("graph-settings-view") == null) {
		customElements.define("graph-settings-view", GraphSettingsView, {
			extends: "div",
		});
	}
} catch (e) {
	// console.error(e);
}
