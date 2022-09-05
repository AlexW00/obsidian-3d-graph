import {DisplaySettings} from "../../settings/categories/DisplaySettings";
import {Setting} from "obsidian";

const DisplaySettingsView = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	NodeSizeSetting(displaySettings, containerEl);
	LinkThicknessSetting(displaySettings, containerEl);
	ParticleSizeSetting(displaySettings, containerEl);
	ParticleCountSetting(displaySettings, containerEl);
}

const NodeSizeSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Node Size")
		.addSlider(
			(slider) => {
				slider.setLimits(1, 20, 1)
					.setValue(displaySettings.nodeSize || 0)
					.onChange(async (value) => {
						displaySettings.nodeSize = value;
					});
			}
		)
}

const LinkThicknessSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Link Thickness")
		.addSlider(
			(slider) => {
				slider.setLimits(1, 20, 1)
					.setValue(displaySettings.linkThickness || 0)
					.onChange(async (value) => {
						displaySettings.linkThickness = value;
					});
			}
		)
}

const ParticleSizeSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Particle Size")
		.addSlider(
			(slider) => {
				slider.setLimits(1, 20, 1)
					.setValue(displaySettings.particleSize || 0)
					.onChange(async (value) => {
						displaySettings.particleSize = value;
					});
			}
		)
}

const ParticleCountSetting = (displaySettings: DisplaySettings, containerEl: HTMLElement) => {
	new Setting(containerEl)
		.setName("Particle Count")
		.addSlider(
			(slider) => {
				slider.setLimits(1, 20, 1)
					.setValue(displaySettings.particleCount || 0)
					.onChange(async (value) => {
						displaySettings.particleCount = value;
					});
			}
		)
}


export default DisplaySettingsView;
