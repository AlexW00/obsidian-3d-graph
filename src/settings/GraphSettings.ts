import {DisplaySettings} from "./categories/DisplaySettings";
import {FilterSettings} from "./categories/FilterSettings";
import {GroupSettings} from "./categories/GroupSettings";

export default class GraphSettings {
	filters: FilterSettings;
	groups: GroupSettings;
	display: DisplaySettings;

	constructor (filterOptions: FilterSettings, groupOptions: GroupSettings, displayOptions: DisplaySettings) {
		this.filters = filterOptions;
		this.groups = groupOptions;
		this.display = displayOptions;
	}

	public reset () {
		this.filters = new FilterSettings();
		this.groups = new GroupSettings();
		this.display = new DisplaySettings();
	}
}

const DEFAULT_SETTINGS = () : GraphSettings => new GraphSettings(
	new FilterSettings(),
	new GroupSettings(),
	new DisplaySettings()
);
export {DEFAULT_SETTINGS};
