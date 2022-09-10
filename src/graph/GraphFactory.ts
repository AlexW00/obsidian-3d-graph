import {ForceGraph} from "./ForceGraph";


export abstract class GraphFactory {
	static createForceGraph = (rootHtmlElement: HTMLElement, isLocalGraph: boolean) => {
		return new ForceGraph(rootHtmlElement, isLocalGraph);
	}
}
