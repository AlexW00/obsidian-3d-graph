import { Setting } from "obsidian";
import { LocalGraphSettings } from "../../../settings/categories/LocalGraphSettings";
import SimpleSliderSetting from "../../atomics/SimpleSliderSetting";
import State from "../../../util/State";

// Depth and link directions, as in the 2D local graph
const LocalGraphSettingsView = (
	localSettings: State<LocalGraphSettings>,
	containerEl: HTMLElement
) => {
	SimpleSliderSetting(
		containerEl,
		{ name: "Depth", value: localSettings.value.depth, stepOptions: { min: 1, max: 5, step: 1 } },
		(value) => {
			localSettings.value.depth = value;
		}
	);
	const toggle = (name: string, key: "incomingLinks" | "outgoingLinks" | "neighborLinks") =>
		new Setting(containerEl).setName(name).addToggle((t) =>
			t.setValue(localSettings.value[key]).onChange((value) => {
				localSettings.value[key] = value;
			})
		);
	toggle("Incoming links", "incomingLinks");
	toggle("Outgoing links", "outgoingLinks");
	toggle("Neighbor links", "neighborLinks");
};

export default LocalGraphSettingsView;
