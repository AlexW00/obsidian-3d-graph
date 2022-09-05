import {FilterSettings} from "../../settings/categories/FilterSettings";
import {Setting} from "obsidian";

const FilterSettingsView = (filterSettings: FilterSettings, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Show Orphans")
		.addToggle((toggle) => {
			toggle.setValue(filterSettings.doShowOrphans || false)
				.onChange(async (value) => {
					filterSettings.doShowOrphans = value;
				});
		});
};

export default FilterSettingsView;
