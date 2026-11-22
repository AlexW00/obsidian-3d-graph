import { DisplaySettings } from "./categories/DisplaySettings";
import { FilterSettings } from "./categories/FilterSettings";
import { GroupSettings } from "./categories/GroupSettings";
import { ForceSettings } from "./categories/ForceSettings";
import { LocalGraphSettings } from "./categories/LocalGraphSettings";

export default class GraphSettings {
	filters: FilterSettings;
	groups: GroupSettings;
	display: DisplaySettings;
	forces: ForceSettings;
	local: LocalGraphSettings;

	constructor(
		filterOptions: FilterSettings,
		groupOptions: GroupSettings,
		displayOptions: DisplaySettings,
		forceOptions: ForceSettings = new ForceSettings(),
		localOptions: LocalGraphSettings = new LocalGraphSettings()
	) {
		this.filters = filterOptions;
		this.groups = groupOptions;
		this.display = displayOptions;
		this.forces = forceOptions;
		this.local = localOptions;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static fromStore(store: any) {
		return new GraphSettings(
			FilterSettings.fromStore(store?.filters),
			GroupSettings.fromStore(store?.groups),
			DisplaySettings.fromStore(store?.display),
			ForceSettings.fromStore(store?.forces),
			LocalGraphSettings.fromStore(store?.local)
		);
	}

	public reset() {
		Object.assign(this.filters, new FilterSettings());
		Object.assign(this.groups, new GroupSettings());
		Object.assign(this.display, new DisplaySettings());
		Object.assign(this.forces, new ForceSettings());
		Object.assign(this.local, new LocalGraphSettings());
	}

	public toObject() {
		return {
			filters: this.filters.toObject(),
			groups: this.groups.toObject(),
			display: this.display.toObject(),
			forces: this.forces.toObject(),
			local: this.local.toObject(),
		};
	}
}
