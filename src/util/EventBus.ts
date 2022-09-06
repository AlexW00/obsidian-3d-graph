import {Events} from "obsidian";

class EventBus extends Events {
	constructor() {
		super();
	}
}

export default new EventBus();
