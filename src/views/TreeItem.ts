export class TreeItem extends HTMLDivElement {

	private readonly $inner: HTMLElement;
	private readonly $children: HTMLElement[];

	constructor($inner: HTMLElement, $children: HTMLElement[]) {
		super();
		this.classList.add("tree-item");
		this.$inner = $inner;
		this.$children = $children;
	}

	onload = () => {
		this.appendSelf();
		this.appendChildren();
	}

	private appendSelf = () => {
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
		this.$children.forEach((child: HTMLElement) => $children.append(child));
		this.append($children);
	}

	private toggleCollapse = (doCollapse? : boolean) => {
		if (doCollapse === undefined) {
			doCollapse = !this.classList.contains("is-collapsed");
		}
		this.classList.toggle("is-collapsed", doCollapse);
	}
}

