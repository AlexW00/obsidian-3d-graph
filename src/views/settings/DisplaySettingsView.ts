import {DisplaySettings} from "../../settings/categories/DisplaySettings";
import SimpleSliderSetting, {DEFAULT_SLIDER_STEP_OPTIONS, SliderOptions} from "./SimpleSliderSetting";

const DisplaySettingsView = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	NodeSizeSetting(displaySettings, containerEl);
	LinkThicknessSetting(displaySettings, containerEl);
	ParticleSizeSetting(displaySettings, containerEl);
	ParticleCountSetting(displaySettings, containerEl);
}

const NodeSizeSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	const options: SliderOptions = {
		name: "Node Size",
		value: displaySettings.nodeSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS
	}
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.nodeSize = value;
	});
}

const LinkThicknessSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	const options: SliderOptions = {
		name: "Link Thickness",
		value: displaySettings.linkThickness,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.linkThickness = value;
	});
}

const ParticleSizeSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	const options: SliderOptions = {
		name: "Particle Size",
		value: displaySettings.particleSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS
	}
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.particleSize = value;
	});
}

const ParticleCountSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	const options: SliderOptions = {
		name: "Particle Count",
		value: displaySettings.particleCount,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS

	}
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.particleCount = value;
	});
}

export default DisplaySettingsView;
