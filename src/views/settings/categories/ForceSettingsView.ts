import { ForceSettings } from "../../../settings/categories/ForceSettings";
import SimpleSliderSetting from "../../atomics/SimpleSliderSetting";
import State from "../../../util/State";

// Same controls and scales as the 2D graph's Forces section
const ForceSettingsView = (forceSettings: State<ForceSettings>, containerEl: HTMLElement) => {
	const slider = (name: string, key: keyof ForceSettings, min: number, max: number, step: number) =>
		SimpleSliderSetting(
			containerEl,
			{ name, value: forceSettings.value[key] as number, stepOptions: { min, max, step } },
			(value) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(forceSettings.value as any)[key] = value;
			}
		);
	slider("Center force", "centerStrength", 0, 1, 0.01);
	slider("Repel force", "repelStrength", 0, 20, 0.1);
	slider("Link force", "linkStrength", 0, 1, 0.01);
	slider("Link distance", "linkDistance", 30, 500, 1);
};

export default ForceSettingsView;
