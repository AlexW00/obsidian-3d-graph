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

const DisplaySettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement,
	onAnimate?: () => void
) => {
	const display = displaySettings.value;
	const toggle = (name: string, key: "showLabels" | "showArrows") =>
		new Setting(containerEl).setName(name).addToggle((t) =>
			t.setValue(display[key]).onChange((value) => {
				displaySettings.value[key] = value;
			})
		);
	const slider = (name: string, key: NumberKey, min: number, max: number, step: number) =>
		SimpleSliderSetting(
			containerEl,
			{ name, value: display[key], stepOptions: { min, max, step } },
			(value) => {
				displaySettings.value[key] = value;
			}
		);

	toggle("Arrows", "showArrows");
	toggle("Labels", "showLabels");
	slider("Text fade threshold", "textFade", -3, 3, 0.1);
	slider("Node size", "nodeSize", 1, 20, 1);

	new Setting(containerEl).setName("Links").addDropdown((dropdown) =>
		dropdown
			.addOptions({ lines: "Lines", particles: "Particles", both: "Lines + particles" })
			.setValue(display.linkStyle)
			.onChange((value) => {
				displaySettings.value.linkStyle = value as LinkStyle;
			})
	);
	slider("Link thickness", "linkThickness", 1, 10, 0.5);
	slider("Particles per link", "motesPerLink", 1, 40, 1);
	slider("Particle size", "particleSize", 0.5, 8, 0.5);
	slider("Particle speed", "particleSpeed", 1, 10, 0.5);
	slider("Particle spread", "particleArc", 0, 1, 0.05);
	slider("Particle solidity", "particleSolidity", 0, 1, 0.05);
	slider("Stream coalescence", "streamCoalescence", 0, 1, 0.05);

	if (onAnimate) {
		const buttonContainer = containerEl.createDiv({ cls: "graph-control-animate" });
		new ButtonComponent(buttonContainer).setButtonText("Animate").onClick(onAnimate);
	}
};

export default DisplaySettingsView;
