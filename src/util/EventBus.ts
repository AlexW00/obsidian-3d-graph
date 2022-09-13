import { Events } from "obsidian";

// Event bus for internal Plugin communication
class EventBus extends Events {
	constructor() {
		super();
	}
}

export default new EventBus();
