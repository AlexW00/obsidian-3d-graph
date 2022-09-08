import {GroupSettings, NodeGroup} from "../../settings/categories/GroupSettings";
import {Setting} from "obsidian";
import Graph3dPlugin from "../../main";

const GroupSettingsView = (groupSettings: GroupSettings, containerEl: HTMLElement) => {
	groupSettings.groups.forEach( (group) =>
		GroupSettingItem(group, containerEl, () => {
			groupSettings.groups = groupSettings.groups.filter( (g) => g !== group);
			containerEl.empty();
			GroupSettingsView(groupSettings, containerEl);
		})
	)
	new Setting(containerEl)
		.addButton(
			(button) => {
				button.setButtonText("New Group")
					.onClick(async () => {
						groupSettings.groups.push(
							new NodeGroup("", Graph3dPlugin.theme.textMuted)
						);
						containerEl.empty();
						GroupSettingsView(groupSettings, containerEl);
					});
			}
		)
}

const GroupSettingItem = (group: NodeGroup, containerEl: HTMLElement, onDelete: () => void) => {
	new Setting(containerEl)
		.addText(
			(text) => {
				text.setValue(group.query)
					.onChange(
						(value) => {
							group.query = value;
						}
					)
			}
		)
		.addText(
			(text) => {
				text.setValue(group.color)
					.onChange( (value) => {
						group.color = value;
					})
			}
		)
		.addExtraButton(
			(button) => {
				button.setIcon("minus")
					.setTooltip("Delete Group")
					.onClick(onDelete);
			}
		)
}

export default GroupSettingsView;
