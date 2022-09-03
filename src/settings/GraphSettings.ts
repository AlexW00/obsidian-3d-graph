import {DisplaySettings} from "./categories/DisplaySettings";
import {FilterSettings} from "./categories/FilterSettings";
import {GroupSettings} from "./categories/GroupSettings";

export class GraphSettings {
	filters: FilterSettings;
	groups: GroupSettings;
	display: DisplaySettings;

	constructor (filterOptions: FilterSettings, groupOptions: GroupSettings, displayOptions: DisplaySettings) {
		this.filters = filterOptions;
		this.groups = groupOptions;
		this.display = displayOptions;
	}
}

export const DEFAULT_SETTINGS = new GraphSettings(
	new FilterSettings(),
	new GroupSettings(),
	new DisplaySettings()
);
