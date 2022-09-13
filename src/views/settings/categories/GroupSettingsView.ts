import { ButtonComponent, ExtraButtonComponent, TextComponent } from "obsidian";
import Graph3dPlugin from "src/main";
import {
	GroupSettings,
	NodeGroup,
} from "src/settings/categories/GroupSettings";
import State, { StateChange } from "src/util/State";
import ColorPicker from "src/views/atomics/ColorPicker";

const GroupSettingsView = (
	groupSettings: State<GroupSettings>,
	containerEl: HTMLElement
) => {
	NodeGroups(groupSettings, containerEl);
	AddNodeGroupButton(groupSettings, containerEl);

	groupSettings.onChange((change: StateChange) => {
		if (
			(change.currentPath === "groups" && change.type === "add") ||
			change.type === "delete"
		) {
			containerEl.empty();
			NodeGroups(groupSettings, containerEl);
			AddNodeGroupButton(groupSettings, containerEl);
		}
	});
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
	containerEl: HTMLElement
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
				new NodeGroup("", Graph3dPlugin.theme.textMuted)
			);
			containerEl.empty();
			GroupSettingsView(groupSettings, containerEl);
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
