import { ButtonComponent, Setting } from "obsidian";
import { DisplaySettings, LinkStyle } from "../../../settings/categories/DisplaySettings";
import SimpleSliderSetting from "../../atomics/SimpleSliderSetting";
import State from "../../../util/State";

type NumberKey =
	| "nodeSize"
	| "linkThickness"
	| "particleSize"
	| "motesPerLink"
	| "particleSpeed"
	| "particleArc"
	| "particleSolidity"
	| "streamCoalescence"
	| "textFade";

// Builders for toggles and sliders bound to the display settings
const controls = (displaySettings: State<DisplaySettings>, containerEl: HTMLElement) => {
	const display = displaySettings.value;
	return {
		toggle: (name: string, key: "showLabels" | "showArrows") =>
			new Setting(containerEl).setName(name).addToggle((t) =>
				t.setValue(display[key]).onChange((value) => {
					displaySettings.value[key] = value;
				})
			),
		slider: (name: string, key: NumberKey, min: number, max: number, step: number) =>
			SimpleSliderSetting(
				containerEl,
				{ name, value: display[key], stepOptions: { min, max, step } },
				(value) => {
					displaySettings.value[key] = value;
				}
			),
	};
};

// Nodes and labels
const DisplaySettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement,
	onAnimate?: () => void
) => {
	const { toggle, slider } = controls(displaySettings, containerEl);
	toggle("Labels", "showLabels");
	slider("Text fade threshold", "textFade", -3, 3, 0.1);
	slider("Node size", "nodeSize", 1, 20, 1);

	if (onAnimate) {
		const buttonContainer = containerEl.createDiv({ cls: "graph-control-animate" });
		new ButtonComponent(buttonContainer).setButtonText("Animate").onClick(onAnimate);
	}
};

// How links are drawn
export const LinkSettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const { toggle, slider } = controls(displaySettings, containerEl);
	new Setting(containerEl)
		.setName("Style")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions({ lines: "Lines", particles: "Particles", both: "Lines + particles" })
				.setValue(displaySettings.value.linkStyle)
				.onChange((value) => {
					displaySettings.value.linkStyle = value as LinkStyle;
				})
		);
	slider("Thickness", "linkThickness", 1, 10, 0.5);
	toggle("Arrows", "showArrows");
};

// The motes flowing along links (in "Lines" style, on hovered links only)
export const ParticleSettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const { slider } = controls(displaySettings, containerEl);
	slider("Per link", "motesPerLink", 1, 40, 1);
	slider("Size", "particleSize", 0.5, 8, 0.5);
	slider("Speed", "particleSpeed", 1, 10, 0.5);
	slider("Spread", "particleArc", 0, 1, 0.05);
	slider("Solidity", "particleSolidity", 0, 1, 0.05);
	slider("Stream coalescence", "streamCoalescence", 0, 1, 0.05);
};

export default DisplaySettingsView;
