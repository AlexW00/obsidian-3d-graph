export type HtmlBuilder = (containerEl: HTMLElement) => void;

export class TreeItem extends HTMLDivElement {

	private readonly $inner: HTMLElement;
	private readonly childrenBuilders: HtmlBuilder [];

	constructor($inner: HTMLElement, children: HtmlBuilder[]) {
		super();
		this.$inner = $inner;
		this.childrenBuilders = children;
	}

	async connectedCallback() {
		this.appendSelf();
		this.appendChildren();
	}

	private appendSelf = () => {
		["graph-control-section", "tree-item"].forEach(
			(className) => this.classList.add(className)
		)

		const $self = createDiv({cls: "tree-item-self"});
		// $self.append(createDiv({cls: "tree-item-icon collapse-icon"}));
		$self.addEventListener(
			"click",
			() => {
				this.toggleCollapse();
			}
		)

		const $inner = createDiv({cls: "tree-item-inner"});
		$inner.append(this.$inner);
		$self.append($inner);
		this.append($self);
	}

	private appendChildren = () => {
		const $children = createDiv({cls: "tree-item-children"});
		this.childrenBuilders.forEach((build: HtmlBuilder) => build($children));
		this.append($children);
	}

	private toggleCollapse = (doCollapse? : boolean) => {
		if (doCollapse === undefined) {
			doCollapse = !this.classList.contains("is-collapsed");
		}
		this.classList.toggle("is-collapsed", doCollapse);
	}
}

try { customElements.define("tree-item", TreeItem, {extends: "div"}); }
catch (e) { console.error(e); }
