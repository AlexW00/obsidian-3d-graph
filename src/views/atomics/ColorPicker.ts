const ColorPicker = (value: string, onChange: (value: string) => void) => {
	const input = document.createElement("input");
	input.type = "color";
	input.value = value;
	input.addEventListener("change", () => {
		onChange(input.value);
	});
	return input;
}

export default ColorPicker;
