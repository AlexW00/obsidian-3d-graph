import { ButtonComponent, ExtraButtonComponent, Setting } from "obsidian";
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

	HiddenList(filterSettings, containerEl.createDiv({ cls: "graph-3d-hidden-list" }));
};

// a node id or link key, as a readable name
const nameOf = (id: string) =>
	id.startsWith("unresolved:")
		? id.slice("unresolved:".length)
		: id.startsWith("#")
		? id
		: (id.split("/").pop() ?? id).replace(/\.md$/i, "");

// Nodes hidden and links broken in the 3D graph, each restorable
const HiddenList = (filterSettings: State<FilterSettings>, containerEl: HTMLElement) => {
	const render = () => {
		containerEl.empty();
		const { hiddenNodes, brokenLinks } = filterSettings.value;
		const count = hiddenNodes.length + brokenLinks.length;
		if (count === 0) return;

		containerEl.createDiv({
			cls: "graph-3d-hidden-title setting-item-name",
			text: `Hidden in 3D (${count})`,
		});
		const row = (label: string, icon: string, restore: () => void) => {
			const item = containerEl.createDiv({ cls: "graph-3d-hidden-item" });
			item.createSpan({ cls: "graph-3d-hidden-icon", text: icon });
			item.createSpan({ cls: "graph-3d-hidden-name", text: label });
			new ExtraButtonComponent(item)
				.setIcon("rotate-ccw")
				.setTooltip("Restore")
				.onClick(restore);
		};
		hiddenNodes.forEach((id) =>
			row(nameOf(id), "◌", () => {
				removeFrom(filterSettings.value.hiddenNodes, id);
			})
		);
		brokenLinks.forEach((key) => {
			const [a, b] = key.split("|");
			row(`${nameOf(a)} ↔ ${nameOf(b)}`, "⤫", () => {
				removeFrom(filterSettings.value.brokenLinks, key);
			});
		});
		new ButtonComponent(containerEl.createDiv({ cls: "graph-3d-hidden-restore" }))
			.setButtonText("Restore all")
			.onClick(() => {
				filterSettings.value.hiddenNodes.splice(0);
				filterSettings.value.brokenLinks.splice(0);
			});
	};
	render();
	// returns the unsubscribe, so the settings view can drop it when rebuilt
	return filterSettings.onChange((change) => {
		const path = change.currentPath ?? "";
		if (path.startsWith("hiddenNodes") || path.startsWith("brokenLinks")) render();
	});
};

// Removes a value from a list, if it is still there (another view may have
// removed it already; splice(-1) would drop the last entry instead)
const removeFrom = (list: string[], value: string) => {
	const index = list.indexOf(value);
	if (index !== -1) list.splice(index, 1);
};

export default FilterSettingsView;
