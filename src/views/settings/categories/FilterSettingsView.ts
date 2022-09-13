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
};

export default FilterSettingsView;
