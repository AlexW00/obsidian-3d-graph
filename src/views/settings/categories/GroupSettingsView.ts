import { ButtonComponent, ExtraButtonComponent, Setting, TextComponent } from "obsidian";
import SimpleSliderSetting from "src/views/atomics/SimpleSliderSetting";
import {
	GroupSettings,
	NodeGroup,
} from "src/settings/categories/GroupSettings";
import ObsidianTheme from "src/util/ObsidianTheme";
import State, { StateChange } from "src/util/State";
import ColorPicker from "src/views/atomics/ColorPicker";

const GroupSettingsView = (
	groupSettings: State<GroupSettings>,
	containerEl: HTMLElement,
	theme: ObsidianTheme
) => {
	ClusterSettings(groupSettings, containerEl.createDiv());
	const groupsEl = containerEl.createDiv();
	const render = () => {
		groupsEl.empty();
		NodeGroups(groupSettings, groupsEl);
		AddNodeGroupButton(groupSettings, groupsEl, theme, render);
	};
	render();

	return groupSettings.onChange((change: StateChange) => {
		const path = change.currentPath ?? "";
		if (
			path.startsWith("groups") &&
			(change.type === "add" || change.type === "delete")
		)
			render();
	});
};

// Automatic coloring by detected cluster
const ClusterSettings = (groupSettings: State<GroupSettings>, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Color by cluster")
		.addToggle((toggle) =>
			toggle.setValue(groupSettings.value.colorByCluster).onChange((value) => {
				groupSettings.value.colorByCluster = value;
			})
		)
		.nameEl.setAttr(
			"aria-label",
			"Detects groups of closely linked notes and gives each a color"
		);
	SimpleSliderSetting(
		containerEl,
		{
			name: "Group count",
			value: groupSettings.value.clusterCount,
			stepOptions: { min: 2, max: 12, step: 1 },
		},
		(value) => {
			groupSettings.value.clusterCount = value;
		}
	);
	SimpleSliderSetting(
		containerEl,
		{
			name: "Cluster pull",
			value: groupSettings.value.clusterPull,
			stepOptions: { min: 0, max: 1, step: 0.05 },
		},
		(value) => {
			groupSettings.value.clusterPull = value;
		}
	);
};

const NodeGroups = (
	groupSettings: State<GroupSettings>,
	containerEl: HTMLElement
) => {
	containerEl.querySelector(".node-group-container")?.remove();
	const nodeGroupContainerEl = containerEl.createDiv({
		cls: "graph-color-groups-container",
	});
	groupSettings.value.groups.forEach((group, index) => {
		const groupState = groupSettings.createSubState(
			`value.groups.${index}`,
			NodeGroup
		);
		GroupSettingItem(groupState, nodeGroupContainerEl, () => {
			groupSettings.value.groups.splice(index, 1);
		});
	});
};

const AddNodeGroupButton = (
	groupSettings: State<GroupSettings>,
	containerEl: HTMLElement,
	theme: ObsidianTheme,
	rerender: () => void
) => {
	containerEl.querySelector(".graph-color-button-container")?.remove();

	const buttonContainer = containerEl.createDiv({
		cls: "graph-color-button-container",
	});
	new ButtonComponent(buttonContainer)
		.setClass("mod-cta")
		.setButtonText("Add Group")
		.onClick(() => {
			groupSettings.value.groups.push(
				new NodeGroup("", ObsidianTheme.toHex(theme.textAccent))
			);
			rerender();
		});
};
const GroupSettingItem = (
	group: State<NodeGroup>,
	containerEl: HTMLElement,
	onDelete: () => void
) => {
	const groupEl = containerEl.createDiv({ cls: "graph-color-group" });

	new TextComponent(groupEl).setValue(group.value.query).onChange((value) => {
		group.value.query = value;
	});

	ColorPicker(groupEl, group.value.color, (value) => {
		group.value.color = value;
	});

	new ExtraButtonComponent(groupEl)
		.setIcon("cross")
		.setTooltip("Delete Group")
		.onClick(onDelete);
};

export default GroupSettingsView;
