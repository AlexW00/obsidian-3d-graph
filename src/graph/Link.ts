import Node from "./Node";
import hash from "../util/Hash";

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
				const node1Id = hash(id),
					node2Id = hash(targetId);

				const link = new Link(node1Id, node2Id);

				const [node1Index, node2Index] = [nodeIndex.get(node1Id), nodeIndex.get(node2Id)];
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
