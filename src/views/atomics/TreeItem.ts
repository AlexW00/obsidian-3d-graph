import { setIcon } from "obsidian";

export type HtmlBuilder = (containerEl: HTMLElement) => void;

// Collapsable tree item, imitates Obsidian's tree items
export class TreeItem extends HTMLDivElement {
	private readonly $inner: HTMLElement;
	private readonly childrenBuilders: HtmlBuilder[];
	private $collapseIcon: HTMLElement | undefined;

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
		["graph-control-section", "tree-item"].forEach((className) =>
			this.classList.add(className)
		);

		// same markup as the core graph's collapsible sections
		const $self = createDiv({ cls: "tree-item-self mod-collapsible is-clickable" });

		$self.addEventListener("click", () => {
			this.toggleCollapse();
		});

		this.$collapseIcon = $self.createDiv({ cls: "tree-item-icon collapse-icon" });
		setIcon(this.$collapseIcon, "right-triangle");
		this.$collapseIcon.toggleClass("is-collapsed", this.classList.contains("is-collapsed"));

		const $inner = createDiv({ cls: "tree-item-inner" });
		$inner.append(this.$inner);
		$self.append($inner);
		this.append($self);
	};

	private appendChildren = () => {
		const $children = createDiv({ cls: "tree-item-children" });
		this.childrenBuilders.forEach((build: HtmlBuilder) => build($children));
		this.append($children);
	};

	private toggleCollapse = (doCollapse?: boolean) => {
		if (doCollapse === undefined) {
			doCollapse = !this.classList.contains("is-collapsed");
		}
		this.classList.toggle("is-collapsed", doCollapse);
		this.$collapseIcon?.toggleClass("is-collapsed", doCollapse);
	};
}

if (typeof customElements.get("tree-item") === "undefined") {
	customElements.define("tree-item", TreeItem, { extends: "div" });
}
