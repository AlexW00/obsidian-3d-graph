import {GroupSettings, NodeGroup} from "../../settings/categories/GroupSettings";
import {Setting} from "obsidian";
import Graph3dPlugin from "../../main";
import State, {StateChange} from "../../util/State";
import ColorPicker from "../atomics/ColorPicker";

const GroupSettingsView = (groupSettings: State<GroupSettings>, containerEl: HTMLElement) => {
	NodeGroups(groupSettings, containerEl);
	AddNodeGroupButton(groupSettings, containerEl);

	groupSettings.onChange((change: StateChange) => {
		if (change.currentPath === "groups" && change.type === "add" || change.type === "delete") {
			containerEl.empty();
			NodeGroups(groupSettings, containerEl);
			AddNodeGroupButton(groupSettings, containerEl);
		}
	});
}

const NodeGroups = (groupSettings: State<GroupSettings>, containerEl: HTMLElement) => {
	groupSettings.value.groups.forEach((group, index) => {
			const groupState = groupSettings.createSubState(`value.groups.${index}`, NodeGroup);
			GroupSettingItem(groupState, containerEl, () => {
				groupSettings.value.groups.splice(index, 1);
			})
		}
	)
}

const AddNodeGroupButton = (groupSettings: State<GroupSettings>, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.addButton(
			(button) => {
				button.setButtonText("New Group")
					.setClass("mod-cta")
					.onClick(async () => {
						groupSettings.value.groups.push(
							new NodeGroup("", Graph3dPlugin.theme.textMuted)
						);
						containerEl.empty();
						GroupSettingsView(groupSettings, containerEl);
					});
			}
		)
}


const GroupSettingItem = (group: State<NodeGroup>, containerEl: HTMLElement, onDelete: () => void) => {
	const nodeGroup = new Setting(containerEl)
		.addText(
			(text) => {
				text.setValue(group.value.query)
					.onChange(
						(value) => {
							group.value.query = value;
						}
					)
			}
		);
	nodeGroup.controlEl.appendChild(ColorPicker(group.value.color, (color) => {
		group.value.color = color;
	}));

	nodeGroup.addExtraButton(
			(button) => {
				button.setIcon("minus")
					.setTooltip("Delete Group")
					.onClick(onDelete);
			}
		)
}

export default GroupSettingsView;
