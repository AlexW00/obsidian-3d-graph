import { Setting } from "obsidian";
import { FilterSettings } from "src/settings/categories/FilterSettings";
import State from "src/util/State";

type BooleanKey =
	| "doShowOrphans"
	| "doShowAttachments"
	| "doShowTags"
	| "doShowUnresolved";

const FilterSettingsView = (
	filterSettings: State<FilterSettings>,
	containerEl: HTMLElement
) => {
	const ownFilters: Setting[] = [];
	const setOwnFiltersEnabled = (enabled: boolean) =>
		ownFilters.forEach((setting) => {
			setting.setDisabled(!enabled);
			setting.settingEl.toggleClass("is-disabled", !enabled);
		});

	const match = new Setting(containerEl)
		.setName("Match 2D graph")
		.addToggle((toggle) =>
			toggle
				.setValue(filterSettings.value.matchCoreGraph)
				.onChange((value) => {
					filterSettings.value.matchCoreGraph = value;
					setOwnFiltersEnabled(!value);
				})
		);

	// a description would squeeze the name in the narrow panel; use a tooltip
	match.nameEl.setAttr(
		"aria-label",
		"Use the filters and color groups of Obsidian's graph view instead of the ones below"
	);

	const search = new Setting(containerEl)
		.setClass("mod-search-setting")
		.addSearch((component) =>
			component
				.setPlaceholder("Search files…")
				.setValue(filterSettings.value.search)
				.onChange((value) => {
					filterSettings.value.search = value;
				})
		);
	search.infoEl.remove();
	ownFilters.push(search);

	// `inverted` toggles show the opposite of the stored flag
	const toggle = (name: string, key: BooleanKey, inverted = false) =>
		ownFilters.push(
			new Setting(containerEl).setName(name).addToggle((t) =>
				t
					.setValue(filterSettings.value[key] !== inverted)
					.onChange((value) => {
						filterSettings.value[key] = value !== inverted;
					})
			)
		);
	toggle("Tags", "doShowTags");
	toggle("Attachments", "doShowAttachments");
	toggle("Existing files only", "doShowUnresolved", true);
	toggle("Orphans", "doShowOrphans");

	setOwnFiltersEnabled(!filterSettings.value.matchCoreGraph);
};

export default FilterSettingsView;
