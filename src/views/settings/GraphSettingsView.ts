import { TreeItem } from "../atomics/TreeItem";
import DisplaySettingsView, {
	LinkSettingsView,
	ParticleSettingsView,
} from "./categories/DisplaySettingsView";
import { FilterSettings } from "../../settings/categories/FilterSettings";
import { GroupSettings } from "../../settings/categories/GroupSettings";
import { DisplaySettings } from "../../settings/categories/DisplaySettings";
import { ExtraButtonComponent } from "obsidian";
import State, { StateChange } from "../../util/State";
import EventBus from "../../util/EventBus";
import GroupSettingsView from "./categories/GroupSettingsView";
import FilterSettingsView from "./categories/FilterSettingsView";
import GraphSettings from "src/settings/GraphSettings";
import ObsidianTheme from "src/util/ObsidianTheme";
import { ForceSettings } from "../../settings/categories/ForceSettings";
import { LocalGraphSettings } from "../../settings/categories/LocalGraphSettings";
import ForceSettingsView from "./categories/ForceSettingsView";
import LocalGraphSettingsView from "./categories/LocalGraphSettingsView";

export interface GraphSettingsViewOptions {
	isLocalGraph: boolean;
	onAnimate: () => void;
}

export class GraphSettingsView extends HTMLDivElement {
	private settingsButton: ExtraButtonComponent;
	private graphControls: HTMLDivElement;
	private readonly settingsState: State<GraphSettings>;
	private readonly theme: ObsidianTheme;
	private readonly options: GraphSettingsViewOptions;

	constructor(
		settingsState: State<GraphSettings>,
		theme: ObsidianTheme,
		options: GraphSettingsViewOptions
	) {
		super();
		this.settingsState = settingsState;
		this.theme = theme;
		this.options = options;
	}

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
			this.settingsState.createSubState("value.filters", FilterSettings),
			"Filters",
			FilterSettingsView
		);
		this.appendSetting(
			this.settingsState.createSubState("value.groups", GroupSettings),
			"Groups",
			(...args) => GroupSettingsView(...args, this.theme)
		);
		if (this.options.isLocalGraph)
			this.appendSetting(
				this.settingsState.createSubState("value.local", LocalGraphSettings),
				"Local graph",
				LocalGraphSettingsView
			);
		// links and particles live in the display settings, shown as their own sections
		const display = this.settingsState.createSubState("value.display", DisplaySettings);
		this.appendSetting(display, "Display", (setting, containerEl) =>
			DisplaySettingsView(setting, containerEl, this.options.onAnimate)
		);
		this.appendSetting(display, "Links", LinkSettingsView);
		this.appendSetting(display, "Particles", ParticleSettingsView);
		this.appendSetting(
			this.settingsState.createSubState("value.forces", ForceSettings),
			"Forces",
			ForceSettingsView
		);
		this.initListeners();
		this.toggleCollapsed(this.isCollapsedState.value);
	}

	private initListeners() {
		const onReset = () => {
			// Re append all settings
			this.disconnectedCallback();
			this.connectedCallback();
		};
		EventBus.on("did-reset-settings", onReset);
		this.callbackUnregisterHandles.push(() =>
			EventBus.off("did-reset-settings", onReset)
		);
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
		// may return a cleanup (e.g. an unsubscribe) to run when the view is rebuilt
		view: (setting: S, containerEl: HTMLElement) => void | (() => void)
	) {
		const header = document.createElement("header");
		header.classList.add("graph-control-section-header");
		header.textContent = title;
		const item = new TreeItem(header, [
			(containerEl: HTMLElement) => {
				const cleanup = view(setting, containerEl);
				if (cleanup) this.callbackUnregisterHandles.push(cleanup);
			},
		]);
		item.classList.add("is-collapsed");
		this.graphControls.append(item);
	}

	async disconnectedCallback() {
		this.empty();
		this.callbackUnregisterHandles.forEach((handle) => handle());
		this.callbackUnregisterHandles = [];
	}
}

if (typeof customElements.get("graph-settings-view") === "undefined") {
	customElements.define("graph-settings-view", GraphSettingsView, {
		extends: "div",
	});
}
