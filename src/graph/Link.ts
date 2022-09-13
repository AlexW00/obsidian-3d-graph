import Node from "./Node";

export type ResolvedLinkCache = Record<string, Record<string, number>>;

export default class Link {
	source: string;
	target: string;

	constructor(sourceId: string, targetId: string) {
		this.source = sourceId;
		this.target = targetId;
	}

	static createLinkIndex(links: Link[]): Map<string, Map<string, number>> {
		const linkIndex = new Map<string, Map<string, number>>();
		links.forEach((link, index) => {
			if (!linkIndex.has(link.source)) {
				linkIndex.set(link.source, new Map<string, number>());
			}
			linkIndex.get(link.source)?.set(link.target, index);
		});

		return linkIndex;
	}

	static createFromCache(
		cache: ResolvedLinkCache,
		nodes: Node[],
		nodeIndex: Map<string, number>
	): Link[] {
		return Object.keys(cache)
			.map((node1Id) => {
				return Object.keys(cache[node1Id])
					.map((node2Id) => {
						const [node1Index, node2Index] = [
							nodeIndex.get(node1Id),
							nodeIndex.get(node2Id),
						];
						if (
							node1Index !== undefined &&
							node2Index !== undefined
						) {
							return nodes[node1Index].addNeighbor(
								nodes[node2Index]
							);
						}
						return null;
					})
					.flat()
					.filter(
						(link) => link !== null && link.source !== link.target
					) as Link[];
			})
			.flat();
	}
}
