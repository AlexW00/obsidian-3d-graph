import {GroupSettings, NodeGroup} from "../../settings/categories/GroupSettings";
import {Setting} from "obsidian";

const GroupSettingsView = (groupSettings: GroupSettings, containerEl: HTMLElement) => {
	groupSettings.groups.forEach( (group) =>
		GroupSettingItem(group, containerEl, () => {
			groupSettings.groups = groupSettings.groups.filter( (g) => g !== group);
		})
	)
	new Setting(containerEl)
		.addButton(
			(button) => {
				button.setButtonText("New Group")
					.onClick(async () => {
						groupSettings.groups.push(
							new NodeGroup("", "")
						);
					});
			}
		)
}

const GroupSettingItem = (group: NodeGroup, containerEl: HTMLElement, onDelete: () => void) => {
	new Setting(containerEl)
		.addText(
			(text) => {
				text.setValue(group.query + " " + group.color)
			}
		)
		.addExtraButton(
			(button) => {
				button.setIcon("minus")
					.setTooltip("Delete Group")
					.onClick(() => {
						onDelete();
					});
			}
		);
}

export default GroupSettingsView;
