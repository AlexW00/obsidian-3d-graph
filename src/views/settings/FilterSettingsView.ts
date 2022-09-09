import {FilterSettings} from "../../settings/categories/FilterSettings";
import {Setting} from "obsidian";
import State from "../../util/State";

const FilterSettingsView = (filterSettings: State<FilterSettings>, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Show Orphans")
		.addToggle((toggle) => {
			toggle.setValue(filterSettings.value.doShowOrphans || false)
				.onChange(async (value) => {
					filterSettings.value.doShowOrphans = value;
				});
		});
};

export default FilterSettingsView;
