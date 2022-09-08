import Node, {stringToHash} from "./Node";

export type ResolvedLinkCache = Record<string, Record<string, number>>;

export default class Link {
	source: string;
	target: string;

	constructor(sourceId: string, targetId: string) {
		this.source = sourceId;
		this.target = targetId;
	}

	static createFromCache(cache: ResolvedLinkCache, nodes: Node[], nodeIndex: Map<string, number>) {
		return Object.keys(app.metadataCache.resolvedLinks).map((id) => {
			return Object.keys(app.metadataCache.resolvedLinks[id]).map((targetId) => {
				const link = new Link(stringToHash(id), stringToHash(targetId));

				const [node1Index, node2Index] = [nodeIndex.get(stringToHash(id)), nodeIndex.get(stringToHash(targetId))];
				if (node1Index !== undefined && node2Index !== undefined) {
					nodes[node1Index].addNeighbor(nodes[node2Index]);
					nodes[node2Index].addNeighbor(nodes[node1Index]);

					nodes[node1Index].addLink(link);
					nodes[node2Index].addLink(link);
				}
				return link;
			})
		}).flat()
	}
}
