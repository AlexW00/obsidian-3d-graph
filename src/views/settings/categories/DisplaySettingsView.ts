import { DisplaySettings } from "../../../settings/categories/DisplaySettings";
import SimpleSliderSetting, {
	DEFAULT_SLIDER_STEP_OPTIONS,
	SliderOptions,
} from "../../atomics/SimpleSliderSetting";
import State from "../../../util/State";

const DisplaySettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	NodeSizeSetting(displaySettings, containerEl);
	LinkThicknessSetting(displaySettings, containerEl);
	ParticleSizeSetting(displaySettings, containerEl);
	ParticleCountSetting(displaySettings, containerEl);
};

const NodeSizeSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Node Size",
		value: displaySettings.value.nodeSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.nodeSize = value;
	});
};

const LinkThicknessSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Link Thickness",
		value: displaySettings.value.linkThickness,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.linkThickness = value;
	});
};

const ParticleSizeSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Particle Size",
		value: displaySettings.value.particleSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.particleSize = value;
	});
};

const ParticleCountSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Particle Count",
		value: displaySettings.value.particleCount,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.particleCount = value;
	});
};

export default DisplaySettingsView;
