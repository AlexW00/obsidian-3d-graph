import { Setting } from "obsidian";
import { FilterSettings } from "src/settings/categories/FilterSettings";
import State from "src/util/State";

const FilterSettingsView = (
	filterSettings: State<FilterSettings>,
	containerEl: HTMLElement
) => {
	new Setting(containerEl).setName("Show Orphans").addToggle((toggle) => {
		toggle
			.setValue(filterSettings.value.doShowOrphans || false)
			.onChange(async (value) => {
				filterSettings.value.doShowOrphans = value;
			});
	});
	new Setting(containerEl).setName("Show Attachments").addToggle((toggle) => {
		toggle
			.setValue(filterSettings.value.doShowAttachments || false)
			.onChange(async (value) => {
				filterSettings.value.doShowAttachments = value;
			});
	});
};

export default FilterSettingsView;
