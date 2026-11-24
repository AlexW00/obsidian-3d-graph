// Community detection with the Louvain method: repeatedly moves each node to
// the neighboring community that most increases modularity, then merges each
// community into a single node and repeats on the smaller graph.
// Deterministic: nodes are visited in the order given.

type Adjacency = Map<number, number>[]; // symmetric; A[i][i] holds 2 × internal weight

const localMoves = (adj: Adjacency, resolution: number): number[] => {
	const n = adj.length;
	const degree = adj.map((row) => {
		let k = 0;
		row.forEach((w) => (k += w));
		return k;
	});
	const twoM = degree.reduce((a, b) => a + b, 0);
	const community = Array.from({ length: n }, (_, i) => i);
	const total = degree.slice(); // sum of degrees per community
	if (twoM === 0) return community;

	for (let pass = 0; pass < 20; pass++) {
		let moved = false;
		for (let i = 0; i < n; i++) {
			const current = community[i];
			const ki = degree[i];
			// weight from i to each neighboring community
			const toCommunity = new Map<number, number>();
			adj[i].forEach((w, j) => {
				if (j === i) return;
				const c = community[j];
				toCommunity.set(c, (toCommunity.get(c) ?? 0) + w);
			});

			total[current] -= ki;
			let best = current;
			let bestGain =
				(toCommunity.get(current) ?? 0) - (resolution * total[current] * ki) / twoM;
			toCommunity.forEach((w, c) => {
				const gain = w - (resolution * total[c] * ki) / twoM;
				if (gain > bestGain + 1e-12) {
					bestGain = gain;
					best = c;
				}
			});
			total[best] += ki;
			if (best !== current) {
				community[i] = best;
				moved = true;
			}
		}
		if (!moved) break;
	}
	return community;
};

// Returns a community index for each node id
export const louvain = (
	nodeIds: string[],
	// [source, target, weight (default 1)]
	edges: [string, string, number?][],
	resolution = 1
): Map<string, number> => {
	const index = new Map(nodeIds.map((id, i) => [id, i] as [string, number]));
	let adj: Adjacency = nodeIds.map(() => new Map());
	edges.forEach(([s, t, w = 1]) => {
		const [a, b] = [index.get(s), index.get(t)];
		if (a === undefined || b === undefined || a === b || w <= 0) return;
		adj[a].set(b, (adj[a].get(b) ?? 0) + w);
		adj[b].set(a, (adj[b].get(a) ?? 0) + w);
	});

	// membership[original node] = node in the current (aggregated) graph
	let membership = nodeIds.map((_, i) => i);
	for (let level = 0; level < 10; level++) {
		const community = localMoves(adj, resolution);
		// renumber communities 0..k-1
		const renumber = new Map<number, number>();
		community.forEach((c) => {
			if (!renumber.has(c)) renumber.set(c, renumber.size);
		});
		if (renumber.size === adj.length) break; // nothing merged

		membership = membership.map((m) => renumber.get(community[m]) as number);
		const next: Adjacency = Array.from({ length: renumber.size }, () => new Map());
		adj.forEach((row, i) => {
			const ci = renumber.get(community[i]) as number;
			row.forEach((w, j) => {
				const cj = renumber.get(community[j]) as number;
				next[ci].set(cj, (next[ci].get(cj) ?? 0) + w);
			});
		});
		adj = next;
	}

	return new Map(nodeIds.map((id, i) => [id, membership[i]] as [string, number]));
};

// Colors for clusters, readable on light and dark backgrounds
const PALETTE = [
	"#4e79a7",
	"#f28e2b",
	"#e15759",
	"#76b7b2",
	"#59a14f",
	"#edc948",
	"#b07aa1",
	"#ff9da7",
	"#9c755f",
];

// The nth cluster color; beyond the palette, spread hues by the golden angle
export const clusterColor = (n: number): string =>
	n < PALETTE.length
		? PALETTE[n]
		: `hsl(${Math.round((n * 137.508) % 360)}, 55%, 58%)`;

// Splits the nodes into (at most) `count` clusters: a fine Louvain partition,
// then repeatedly merging the two most strongly connected clusters (the merge
// that adds the most modularity) until `count` remain. Nodes with no edges
// stay on their own; clusters with no edges between them can't be merged, so
// the result can have fewer merges than asked for.
// merges left when clusterInto switches from batched rounds to one at a time
const EXACT_MERGES = 64;

export const clusterInto = (
	nodeIds: string[],
	edges: [string, string, number?][],
	count: number
): Map<string, number> => {
	const connected = new Set<string>();
	edges.forEach(([s, t, w = 1]) => {
		if (s !== t && w > 0) {
			connected.add(s);
			connected.add(t);
		}
	});
	const countConnected = (p: Map<string, number>) =>
		new Set([...connected].map((id) => p.get(id))).size;

	// start fine enough to have at least `count` clusters to merge from
	let partition = louvain(nodeIds, edges, 2);
	for (let r = 4; r <= 32 && countConnected(partition) < count; r *= 2)
		partition = louvain(nodeIds, edges, r);

	// cluster-level weights and degree totals
	const between = new Map<number, Map<number, number>>();
	const total = new Map<number, number>();
	let twoM = 0;
	const add = (a: number, b: number, w: number) => {
		const row = between.get(a) ?? new Map<number, number>();
		row.set(b, (row.get(b) ?? 0) + w);
		between.set(a, row);
	};
	edges.forEach(([s, t, w = 1]) => {
		if (s === t || w <= 0) return;
		const [a, b] = [partition.get(s), partition.get(t)];
		if (a === undefined || b === undefined) return;
		total.set(a, (total.get(a) ?? 0) + w);
		total.set(b, (total.get(b) ?? 0) + w);
		twoM += 2 * w;
		if (a !== b) {
			add(a, b, w);
			add(b, a, w);
		}
	});

	const alive = new Set(total.keys());
	const mergedInto = new Map<number, number>();
	const gainOf = (a: number, b: number, w: number) =>
		w / twoM - ((total.get(a) ?? 0) * (total.get(b) ?? 0)) / (twoM * twoM);
	// fold the cluster with fewer neighbors into the other, so a hub that
	// absorbs many small clusters isn't copied each time
	const merge = (a: number, b: number) => {
		const [keep, gone] =
			(between.get(a)?.size ?? 0) >= (between.get(b)?.size ?? 0) ? [a, b] : [b, a];
		between.get(gone)?.forEach((w, other) => {
			if (other === keep) return;
			add(keep, other, w);
			add(other, keep, w);
			between.get(other)?.delete(gone);
		});
		between.get(keep)?.delete(gone);
		between.delete(gone);
		total.set(keep, (total.get(keep) ?? 0) + (total.get(gone) ?? 0));
		alive.delete(gone);
		mergedInto.set(gone, keep);
	};

	// Greedy merging, best pair first. Rescoring every pair after each merge is
	// quadratic when many small clusters hang off one hub (a tag on thousands
	// of notes), so while many merges remain, each round scores the pairs once
	// and makes half of the merges still needed. The last EXACT_MERGES, which
	// shape the big clusters, are made one at a time, each scored afresh.
	while (alive.size > count) {
		const pairs: [number, number, number][] = [];
		alive.forEach((a) =>
			between.get(a)?.forEach((w, b) => {
				if (b > a && alive.has(b)) pairs.push([gainOf(a, b, w), a, b]);
			})
		);
		if (pairs.length === 0) break; // the rest have no edges between them
		pairs.sort((x, y) => y[0] - x[0] || x[1] - y[1] || x[2] - y[2]);
		const excess = alive.size - count;
		let budget = excess <= EXACT_MERGES ? 1 : Math.ceil(excess / 2);
		for (const [, a, b] of pairs) {
			if (budget === 0) break;
			// a pair can go stale when one side was merged away this round
			if (!alive.has(a) || !alive.has(b)) continue;
			merge(a, b);
			budget--;
		}
	}

	const resolve = (c: number): number => {
		let r = c;
		while (mergedInto.has(r)) r = mergedInto.get(r) as number;
		return r;
	};
	return new Map(nodeIds.map((id) => [id, resolve(partition.get(id) as number)] as [string, number]));
};
