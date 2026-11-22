import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import { Notice } from "obsidian";
import * as THREE from "three";
import { forceX, forceY, forceZ } from "d3-force-3d";
import Node from "../../graph/Node";
import Link from "../../graph/Link";
import { StateChange } from "../../util/State";
import Graph3dPlugin from "../../main";
import Graph from "../../graph/Graph";
import { NodeGroup } from "../../settings/categories/GroupSettings";
import EventBus from "../../util/EventBus";
import ObsidianTheme from "../../util/ObsidianTheme";
import { compileQuery, isEmptyQuery, Matcher, unsupportedSyntax } from "../../graph/Search";
import { clusterColor, clusterInto } from "../../graph/Clusters";

// a cluster needs at least this many notes to get a color
const MIN_CLUSTER_SIZE = 2;
const MAX_LEGEND_ITEMS = 12;

interface Cluster {
	color: string;
	name: string;
	noteCount: number;
	members: Set<string>;
}

// Adapted from https://github.com/vasturiano/3d-force-graph/blob/master/example/highlight/index.html

// Appends to the list stored under a key, creating it if needed
const pushTo = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
};

// Tags on more notes than this join their notes through one shared hub
// instead of an edge for every pair, which would grow with the square
const TAG_PAIR_LIMIT = 30;

const WARMUP_TICKS = 120;

// D3 replaces link source/target ids with the node objects once rendered
const endpointId = (end: string | Node): string =>
	typeof end === "string" ? end : end.id;

// label height in world units, relative to the node size setting
const LABEL_SCALE = 1.1;
// labels start fading at this multiple of the graph's radius (text fade = 0),
// which is about where zoom-to-fit puts the camera
const LABEL_FADE_RADII = 3.2;

type Positioned = Node & { x?: number; y?: number; z?: number };

export class ForceGraph {
	private instance: ForceGraph3DInstance;
	private readonly rootHtmlElement: HTMLElement;
	private readonly plugin: Graph3dPlugin;
	private readonly isLocalGraph: boolean;

	private readonly highlightedNodes: Set<string> = new Set();
	private readonly highlightedLinks: Set<Link> = new Set();
	hoveredNode: Node | null = null;
	// called when the hovered node changes, with the last mouse event
	public onHover: ((node: Node | null, event: MouseEvent | null) => void) | null =
		null;
	private lastMouseEvent: MouseEvent | null = null;

	// every node and link of the global or local graph, before filtering
	private fullGraph: Graph;
	// what is actually rendered: fullGraph after the filters
	private graph: Graph;
	private readonly visibleDegree = new Map<string, number>();
	private colorGroups: { matches: Matcher; color: string }[] = [];
	private clusters: Cluster[] = [];
	private warnedQuery: string | null = null;
	private clusterCache: { key: string; community: Map<string, number> } | null = null;
	private readonly clusterColorOf = new Map<string, string>();
	private readonly clusterIndexOf = new Map<string, number>();
	private legendEl: HTMLElement | undefined;

	private readonly labels = new Map<string, THREE.Sprite>();
	private readonly labelFade = new Map<string, number>();
	private hasFramedGraph = false;
	private filterTimer = 0;
	private animationTimer = 0;
	private readonly unsubscribers: (() => void)[] = [];

	constructor(
		plugin: Graph3dPlugin,
		rootHtmlElement: HTMLElement,
		isLocalGraph: boolean
	) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;
		this.plugin = plugin;

		this.createGraph();
		// after the graph: the renderer clears its container when it starts
		this.legendEl = this.rootHtmlElement.createDiv({ cls: "graph-3d-cluster-legend" });
		this.initListeners();
		this.renderLegend();
	}

	private initListeners() {
		this.unsubscribers.push(
			this.plugin.settingsState.onChange(this.onSettingsStateChanged)
		);
		if (this.isLocalGraph)
			this.unsubscribers.push(
				this.plugin.openFileState.onChange(this.onOpenFileChanged)
			);
		EventBus.on("graph-changed", this.onVaultGraphChanged);
		EventBus.on("theme-changed", this.onThemeChanged);
		EventBus.on("core-graph-options-changed", this.onCoreOptionsChanged);

		const trackMouse = (event: MouseEvent) => (this.lastMouseEvent = event);
		this.rootHtmlElement.addEventListener("mousemove", trackMouse);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const controls = this.instance.controls() as any;
		controls?.addEventListener?.("change", this.updateLabelFade);

		this.unsubscribers.push(() => {
			EventBus.off("graph-changed", this.onVaultGraphChanged);
			EventBus.off("theme-changed", this.onThemeChanged);
			EventBus.off("core-graph-options-changed", this.onCoreOptionsChanged);
			this.rootHtmlElement.removeEventListener("mousemove", trackMouse);
			controls?.removeEventListener?.("change", this.updateLabelFade);
			window.clearTimeout(this.filterTimer);
			window.clearTimeout(this.animationTimer);
		});
	}

	// Stops listening to settings, file and graph changes
	public destroy() {
		this.unsubscribers.forEach((unsubscribe) => unsubscribe());
		this.unsubscribers.length = 0;
		this.legendEl?.remove();
		this.instance._destructor();
	}

	private get settings() {
		return this.plugin.getSettings();
	}

	private get display() {
		return this.settings.display;
	}

	private get theme() {
		return this.plugin.theme;
	}

	private get matchCore() {
		return this.settings.filters.matchCoreGraph;
	}

	private createGraph() {
		this.createInstance();
		this.createNodes();
		this.createLinks();
		this.applyForces();
	}

	private createInstance() {
		this.instance = ForceGraph3D({ controlType: "orbit" })(
			this.rootHtmlElement
		)
			.backgroundColor("rgba(0,0,0,0)")
			.showNavInfo(false)
			.width(this.rootHtmlElement.offsetWidth || window.innerWidth)
			.height(this.rootHtmlElement.offsetHeight || window.innerHeight)
			// settle most of the layout before the first frame, then frame it
			.warmupTicks(WARMUP_TICKS)
			.cooldownTime(2500)
			.onEngineTick(this.updateLabelFade)
			.onEngineStop(this.frameGraph)
			.graphData(this.getGraphData());
	}

	// ====================== Forces ====================== //

	// The forces in effect, on the 2D graph's scales
	private get forces() {
		return this.settings.forces;
	}

	// Maps the 2D graph's force scales onto the 3D layout
	// `reheat` restarts the layout; only valid once the layout exists, and
	// not needed when new graph data restarts it anyway
	private applyForces(reheat = false) {
		const f = this.forces;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charge = this.instance.d3Force("charge") as any;
		charge?.strength?.(-f.repelStrength * 5);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const link = this.instance.d3Force("link") as any;
		link?.distance?.(20 + f.linkDistance * 0.2);
		link?.strength?.(
			(l: Link) =>
				f.linkStrength /
				Math.max(
					1,
					Math.min(
						this.visibleDegree.get(endpointId(l.source)) ?? 1,
						this.visibleDegree.get(endpointId(l.target)) ?? 1
					)
				)
		);
		// a small floor keeps unlinked nodes from drifting off forever in 3D
		const center = 0.02 + f.centerStrength * 0.1;
		this.instance.d3Force("x", forceX(0).strength(center));
		this.instance.d3Force("y", forceY(0).strength(center));
		this.instance.d3Force("z", forceZ(0).strength(center));
		this.instance.d3Force("cluster", this.clusterForce());
		if (reheat) this.instance.d3ReheatSimulation();
	}

	// Zoom to fit the whole graph once its layout settles
	private frameGraph = () => {
		this.updateLabelFade();
		if (this.hasFramedGraph) return;
		this.hasFramedGraph = true;
		this.instance.zoomToFit(500, 40);
	};

	// ====================== Data and filters ====================== //

	private getGraphData = (): Graph => {
		const global = this.plugin.globalGraph.clone();
		const root = this.plugin.openFileState.value;
		this.fullGraph =
			this.isLocalGraph && root ? this.localSubgraph(global, root) : global;
		return this.filterGraph();
	};

	// The filters in effect: the 2D graph's, or this plugin's own
	private get filters() {
		const own = this.settings.filters;
		if (this.matchCore) {
			const core = this.plugin.coreGraphOptions;
			return {
				search: core.search,
				showTags: core.showTags,
				showAttachments: core.showAttachments,
				showUnresolved: !core.hideUnresolved,
				showOrphans: core.showOrphans,
				colorGroups: core.colorGroups,
			};
		}
		return {
			search: own.search,
			showTags: own.doShowTags,
			showAttachments: own.doShowAttachments,
			showUnresolved: own.doShowUnresolved,
			showOrphans: own.doShowOrphans,
			colorGroups: [],
		};
	}

	private get showArrows() {
		return this.display.showArrows;
	}

	private kindShown(node: Node): boolean {
		const f = this.filters;
		switch (node.kind) {
			case "tag":
				return f.showTags;
			case "unresolved":
				return f.showUnresolved;
			case "attachment":
				return f.showAttachments;
			default:
				return true;
		}
	}

	// The local graph: nodes within `depth` links of the root, following
	// incoming and/or outgoing links, like the 2D local graph
	private localSubgraph(graph: Graph, rootId: string): Graph {
		const local = this.settings.local;
		const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as [string, Node]));
		const edges = new Map<string, { other: string; outgoing: boolean }[]>();
		const addEdge = (from: string, other: string, outgoing: boolean) =>
			pushTo(edges, from, { other, outgoing });
		graph.links.forEach((link) => {
			const [s, t] = [endpointId(link.source), endpointId(link.target)];
			addEdge(s, t, true);
			addEdge(t, s, false);
			// a link both ways counts as outgoing and incoming for both notes
			if (link.mutual) {
				addEdge(s, t, false);
				addEdge(t, s, true);
			}
		});

		const level = new Map<string, number>([[rootId, 0]]);
		const queue = [rootId];
		while (queue.length) {
			const id = queue.shift() as string;
			const depth = level.get(id) as number;
			if (depth >= local.depth) continue;
			(edges.get(id) ?? []).forEach(({ other, outgoing }) => {
				if (outgoing ? !local.outgoingLinks : !local.incomingLinks) return;
				const node = nodeById.get(other);
				// don't walk through tags or missing notes that are filtered out
				if (!node || level.has(other) || !this.kindShown(node)) return;
				level.set(other, depth + 1);
				queue.push(other);
			});
		}

		const nodes = graph.nodes.filter((n) => level.has(n.id));
		const links = graph.links.filter((link) => {
			const ls = level.get(endpointId(link.source));
			const lt = level.get(endpointId(link.target));
			if (ls === undefined || lt === undefined) return false;
			// without neighbor links, only keep links that step one level out
			return local.neighborLinks || Math.abs(ls - lt) === 1;
		});
		return new Graph(
			nodes,
			links,
			new Map(nodes.map((n, i) => [n.id, i] as [string, number])),
			new Map()
		);
	}

	// The search as a matcher, or null to show everything. A query using
	// syntax the 3D graph can't evaluate (e.g. content: or [property]) is
	// ignored rather than guessed at, which could empty the graph.
	private compileSearch(query: string): Matcher | null {
		if (isEmptyQuery(query)) return null;
		const unsupported = unsupportedSyntax(query);
		if (unsupported) {
			if (this.warnedQuery !== query) {
				this.warnedQuery = query;
				new Notice(
					`3D graph: the search uses "${unsupported}", which the 3D graph can't filter by, so all notes are shown.`
				);
			}
			return null;
		}
		return compileQuery(query);
	}

	// Applies the filters to fullGraph, like the core graph does:
	// the search picks files, tags and missing notes come along with the files
	// that reference them, and orphans are judged on what remains.
	private filterGraph(): Graph {
		const f = this.filters;
		const search = this.compileSearch(f.search);
		const root = this.isLocalGraph ? this.plugin.openFileState.value : undefined;

		const shown = new Set<string>();
		this.fullGraph.nodes.forEach((node) => {
			if (node.kind !== "note" && node.kind !== "attachment") return;
			if (!this.kindShown(node)) return;
			if (node.id === root || !search || search(node)) shown.add(node.id);
		});
		const inGraph = new Set(this.fullGraph.nodes.map((n) => n.id));
		this.fullGraph.nodes.forEach((node) => {
			if (node.kind === "note" || node.kind === "attachment") return;
			if (
				this.kindShown(node) &&
				node.neighbors.some((n) => inGraph.has(n.id) && shown.has(n.id))
			)
				shown.add(node.id);
		});

		const links = this.fullGraph.links.filter((link) => {
			const [s, t] = [endpointId(link.source), endpointId(link.target)];
			return shown.has(s) && shown.has(t);
		});
		this.visibleDegree.clear();
		links.forEach((link) => {
			[endpointId(link.source), endpointId(link.target)].forEach((id) =>
				this.visibleDegree.set(id, (this.visibleDegree.get(id) ?? 0) + 1)
			);
		});

		const nodes = this.fullGraph.nodes.filter(
			(node) =>
				shown.has(node.id) &&
				(f.showOrphans ||
					node.id === root ||
					(this.visibleDegree.get(node.id) ?? 0) > 0)
		);

		this.compileColorGroups();
		this.graph = new Graph(
			nodes,
			links,
			new Map(nodes.map((n, i) => [n.id, i] as [string, number])),
			new Map()
		);
		this.computeClusters();
		return this.graph;
	}

	// ====================== Clusters ====================== //

	// Detects communities of notes and assigns their colors, biggest cluster
	// first so colors stay stable as the vault grows. Affinity between notes is
	// their links plus the tags they share; each tag adds a total weight of 1
	// per note, so tags on nearly every note count for little. Tags and missing
	// notes on screen then take the cluster most of their notes belong to.
	private computeClusters() {
		this.clusters = [];
		this.clusterColorOf.clear();
		this.clusterIndexOf.clear();
		const groups = this.settings.groups;
		const files = this.graph.nodes.filter(
			(n) => n.kind === "note" || n.kind === "attachment"
		);
		if (groups.colorByCluster && files.length > 0) {
			const fileIds = new Set(files.map((n) => n.id));
			const edges: [string, string, number][] = [];
			this.graph.links.forEach((l) => {
				const [s, t] = [endpointId(l.source), endpointId(l.target)];
				if (fileIds.has(s) && fileIds.has(t)) edges.push([s, t, 1]);
			});
			const notesByTag = new Map<string, string[]>();
			files.forEach((n) => n.tags.forEach((tag) => pushTo(notesByTag, tag, n.id)));
			const hubs: string[] = [];
			notesByTag.forEach((ids, tag) => {
				if (ids.length < 2) return;
				if (ids.length <= TAG_PAIR_LIMIT) {
					const w = 1 / (ids.length - 1);
					for (let i = 0; i < ids.length; i++)
						for (let j = i + 1; j < ids.length; j++) edges.push([ids[i], ids[j], w]);
				} else {
					// a common tag: each of its notes links to one hub, with the
					// same total weight per note as the pairs would give
					const hub = `\u0000tag-hub:${tag}`;
					hubs.push(hub);
					ids.forEach((id) => edges.push([id, hub, 1]));
				}
			});

			// clustering only depends on the notes, their edges and the count,
			// so a search or setting that leaves those alone reuses the last result
			const nodeIds = [...fileIds].sort().concat(hubs.sort());
			const key =
				`${groups.clusterCount}\n${nodeIds.join("\n")}\n` +
				edges.map(([a, b, w]) => `${a}\u0001${b}\u0001${w}`).join("\n");
			let community: Map<string, number>;
			if (this.clusterCache?.key === key) community = this.clusterCache.community;
			else {
				community = clusterInto(nodeIds, edges, groups.clusterCount);
				hubs.forEach((h) => community.delete(h));
				this.clusterCache = { key, community };
			}

			// tags and missing notes join their neighbors' most common cluster
			const assignment = new Map(community);
			const neighborsOf = new Map<string, string[]>();
			this.graph.links.forEach((l) => {
				const [s, t] = [endpointId(l.source), endpointId(l.target)];
				pushTo(neighborsOf, s, t);
				pushTo(neighborsOf, t, s);
			});
			this.graph.nodes.forEach((n) => {
				if (fileIds.has(n.id)) return;
				const votes = new Map<number, number>();
				(neighborsOf.get(n.id) ?? []).forEach((m) => {
					const c = community.get(m);
					if (c !== undefined) votes.set(c, (votes.get(c) ?? 0) + 1);
				});
				let best: number | undefined;
				votes.forEach((v, c) => {
					if (best === undefined || v > (votes.get(best) ?? 0)) best = c;
				});
				if (best !== undefined) assignment.set(n.id, best);
			});
			this.makeClustersConnected(assignment, neighborsOf, fileIds);

			const byCommunity = new Map<number, Node[]>();
			this.graph.nodes.forEach((node) => {
				const c = assignment.get(node.id);
				if (c === undefined) return;
				pushTo(byCommunity, c, node);
			});
			const noteCount = (members: Node[]) =>
				members.filter((n) => fileIds.has(n.id)).length;
			const sorted = [...byCommunity.values()]
				.filter((members) => noteCount(members) >= MIN_CLUSTER_SIZE)
				.sort(
					(a, b) =>
						noteCount(b) - noteCount(a) ||
						(a[0].id < b[0].id ? -1 : 1)
				)
				// pieces split off for connectivity don't count toward the groups
				.slice(0, groups.clusterCount);
			this.clusters = sorted.map((members, i) => {
				// name a cluster after its best-connected note
				const notes = members.filter((n) => fileIds.has(n.id));
				const hub = notes.sort((a, b) => this.degree(b) - this.degree(a))[0];
				const color = clusterColor(i);
				members.forEach((n) => {
					this.clusterColorOf.set(n.id, color);
					this.clusterIndexOf.set(n.id, i);
				});
				return {
					color,
					name: displayName(hub),
					noteCount: notes.length,
					members: new Set(members.map((n) => n.id)),
				};
			});
		}
		this.renderLegend();
	}

	// Every cluster must be one connected piece over the links on screen
	// (shared tags can group notes that have no visible link). A detached
	// piece joins the cluster it has the most links to, or becomes its own.
	private makeClustersConnected(
		assignment: Map<string, number>,
		neighborsOf: Map<string, string[]>,
		fileIds: Set<string>
	) {
		let nextId = Math.max(-1, ...assignment.values()) + 1;
		for (let round = 0; round < 5; round++) {
			// connected pieces of each cluster
			const pieces: { cluster: number; ids: string[]; notes: number }[] = [];
			const seen = new Set<string>();
			assignment.forEach((cluster, start) => {
				if (seen.has(start)) return;
				const ids: string[] = [];
				const stack = [start];
				seen.add(start);
				while (stack.length) {
					const id = stack.pop() as string;
					ids.push(id);
					(neighborsOf.get(id) ?? []).forEach((m) => {
						if (!seen.has(m) && assignment.get(m) === cluster) {
							seen.add(m);
							stack.push(m);
						}
					});
				}
				pieces.push({ cluster, ids, notes: ids.filter((i) => fileIds.has(i)).length });
			});

			// keep the biggest piece of each cluster; move the others
			const main = new Map<number, (typeof pieces)[number]>();
			pieces.forEach((p) => {
				const current = main.get(p.cluster);
				if (!current || p.notes > current.notes || (p.notes === current.notes && p.ids.length > current.ids.length))
					main.set(p.cluster, p);
			});
			const detached = pieces.filter((p) => main.get(p.cluster) !== p);
			if (detached.length === 0) return;

			detached.forEach((piece) => {
				const inPiece = new Set(piece.ids);
				const votes = new Map<number, number>();
				piece.ids.forEach((id) =>
					(neighborsOf.get(id) ?? []).forEach((m) => {
						const c = assignment.get(m);
						if (!inPiece.has(m) && c !== undefined && c !== piece.cluster)
							votes.set(c, (votes.get(c) ?? 0) + 1);
					})
				);
				let target = -1;
				votes.forEach((v, c) => {
					if (target === -1 || v > (votes.get(target) ?? 0)) target = c;
				});
				const cluster = target === -1 ? nextId++ : target;
				piece.ids.forEach((id) => assignment.set(id, cluster));
			});
		}
	}

	// Pulls each cluster's members toward the cluster's center, so a group
	// sits together in space
	private clusterForce() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let nodes: any[] = [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const force = (alpha: number) => {
			const strength = this.settings.groups.clusterPull * 0.25 * alpha;
			if (strength === 0 || this.clusters.length === 0) return;
			const centers = new Map<number, { x: number; y: number; z: number; n: number }>();
			nodes.forEach((node) => {
				const c = this.clusterIndexOf.get(node.id);
				if (c === undefined) return;
				const center = centers.get(c) ?? { x: 0, y: 0, z: 0, n: 0 };
				center.x += node.x;
				center.y += node.y;
				center.z += node.z ?? 0;
				center.n++;
				centers.set(c, center);
			});
			nodes.forEach((node) => {
				const c = this.clusterIndexOf.get(node.id);
				const center = c === undefined ? undefined : centers.get(c);
				if (!center) return;
				node.vx += (center.x / center.n - node.x) * strength;
				node.vy += (center.y / center.n - node.y) * strength;
				node.vz = (node.vz ?? 0) + (center.z / center.n - (node.z ?? 0)) * strength;
			});
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		force.initialize = (n: any[]) => (nodes = n);
		return force;
	}

	private renderLegend() {
		const el = this.legendEl;
		if (!el) return;
		el.empty();
		el.toggleClass("is-hidden", this.clusters.length === 0);
		this.clusters.slice(0, MAX_LEGEND_ITEMS).forEach((cluster) => {
			const item = el.createDiv({ cls: "graph-3d-cluster-item" });
			const dot = item.createSpan({ cls: "graph-3d-cluster-dot" });
			dot.style.backgroundColor = cluster.color;
			item.createSpan({ cls: "graph-3d-cluster-name", text: cluster.name });
			item.createSpan({
				cls: "graph-3d-cluster-count",
				text: String(cluster.noteCount),
			});
			item.addEventListener("mouseenter", () => this.highlightCluster(cluster));
			item.addEventListener("mouseleave", () => this.highlightCluster(null));
			item.addEventListener("click", () =>
				this.instance.zoomToFit(600, 60, (n: Node) => cluster.members.has(n.id))
			);
		});
		const hidden = this.clusters.length - MAX_LEGEND_ITEMS;
		if (hidden > 0)
			el.createDiv({ cls: "graph-3d-cluster-more", text: `+${hidden} more` });
	}

	private highlightCluster(cluster: Cluster | null) {
		this.clearHighlights();
		this.hoveredNode = null;
		if (cluster) {
			cluster.members.forEach((id) => this.highlightedNodes.add(id));
			this.graph.links.forEach((link) => {
				if (
					cluster.members.has(endpointId(link.source)) &&
					cluster.members.has(endpointId(link.target))
				)
					this.highlightedLinks.add(link);
			});
		}
		this.updateHighlight();
	}

	// 2D graph color groups first, then this plugin's groups (last match wins)
	private compileColorGroups() {
		this.colorGroups = [
			...this.filters.colorGroups.map((g) => ({
				matches: compileQuery(g.query),
				color: g.color,
			})),
			...this.settings.groups.groups.map((g) => ({
				matches: (node: Node) => NodeGroup.matches(g.query, node),
				color: g.color,
			})),
		];
	}

	// Feeds new graph data to the renderer, keeping the positions of nodes
	// that were already on screen so the layout doesn't jump
	private setGraphData(graph: Graph, reframe: boolean) {
		window.clearTimeout(this.animationTimer);
		const previous = new Map<string, Record<string, number>>();
		this.instance.graphData().nodes.forEach((n: Record<string, unknown>) => {
			previous.set(n.id as string, n as Record<string, number>);
		});
		graph.nodes.forEach((node) => {
			const old = previous.get(node.id);
			if (old && old !== (node as unknown))
				["x", "y", "z", "vx", "vy", "vz"].forEach(
					(k) => ((node as unknown as Record<string, number>)[k] = old[k])
				);
		});

		this.clearHighlights();
		this.hoveredNode = null;
		if (reframe) this.hasFramedGraph = false;
		this.instance.graphData(graph);
		this.applyForces();
		this.rebuildLabels();
	}

	// the vault changed: rebuild, but keep the camera where it is
	private onVaultGraphChanged = () => {
		this.setGraphData(this.getGraphData(), false);
	};

	// the local graph's file changed: new graph, reframe
	private onOpenFileChanged = () => {
		this.setGraphData(this.getGraphData(), true);
	};

	private onFiltersChanged = () => {
		// the local graph's extent depends on which kinds are shown
		const data = this.isLocalGraph ? this.getGraphData() : this.filterGraph();
		this.setGraphData(data, true);
	};

	private onCoreOptionsChanged = () => {
		if (!this.matchCore) return;
		this.onFiltersChanged();
	};

	// Replays the graph growing in the order files were created, like the
	// 2D graph's "Animate" button
	public animate() {
		window.clearTimeout(this.animationTimer);
		const full = this.graph;
		const files = full.nodes
			.filter((n) => n.kind === "note" || n.kind === "attachment")
			.sort((a, b) => a.ctime - b.ctime);
		if (files.length === 0) return;

		const steps = Math.min(files.length, 150);
		const perStep = Math.ceil(files.length / steps);
		(full.nodes as Positioned[]).forEach((n) => {
			delete n.x;
			delete n.y;
			delete n.z;
		});
		this.clearHighlights();
		this.hoveredNode = null;

		// each step adds nodes to the live layout; re-running the warm-up
		// on every step would block the UI
		this.instance.warmupTicks(0);
		let count = 0;
		const step = () => {
			count = Math.min(files.length, count + perStep);
			const present = new Set(files.slice(0, count).map((n) => n.id));
			full.nodes.forEach((n) => {
				if (
					(n.kind === "tag" || n.kind === "unresolved") &&
					n.neighbors.some((m) => present.has(m.id))
				)
					present.add(n.id);
			});
			this.instance.graphData({
				nodes: full.nodes.filter((n) => present.has(n.id)),
				links: full.links.filter(
					(l) =>
						present.has(endpointId(l.source)) &&
						present.has(endpointId(l.target))
				),
			});
			if (count < files.length)
				this.animationTimer = window.setTimeout(step, 60);
			else {
				this.instance.warmupTicks(WARMUP_TICKS);
				this.rebuildLabels();
			}
		};
		step();
	}

	// ====================== Settings ====================== //

	private onSettingsStateChanged = (data: StateChange) => {
		const path = data.currentPath ?? "";
		if (path.startsWith("filters") || path.startsWith("local")) {
			// typing in the search box fires on every keystroke
			window.clearTimeout(this.filterTimer);
			this.filterTimer = window.setTimeout(this.onFiltersChanged, 250);
			return;
		}
		if (path.startsWith("forces")) {
			this.applyForces(true);
			return;
		}
		if (path.startsWith("groups")) {
			this.compileColorGroups();
			if (path === "groups.colorByCluster" || path === "groups.clusterCount") {
				this.computeClusters();
				this.applyForces(true);
			}
			if (path === "groups.clusterPull") {
				this.applyForces(true);
				return;
			}
		}

		if (path === "display.nodeSize") {
			this.instance.nodeRelSize(data.newValue);
			this.rebuildLabels();
		} else if (path === "display.showLabels" || path === "display.textFade") {
			this.rebuildLabels();
		} else if (path === "display.particleSize") {
			this.instance.linkDirectionalParticleWidth(data.newValue);
		}

		this.updateHighlight(); // re-evaluate colors, widths and arrows
	};

	private onThemeChanged = () => {
		this.rebuildLabels();
		this.updateHighlight();
	};

	public updateDimensions() {
		const [width, height] = [
			this.rootHtmlElement.offsetWidth,
			this.rootHtmlElement.offsetHeight,
		];
		this.setDimensions(width, height);
	}

	public setDimensions(width: number, height: number) {
		this.instance.width(width);
		this.instance.height(height);
	}

	// ====================== Nodes ====================== //

	private degree = (node: Node) => this.visibleDegree.get(node.id) ?? 0;

	// sphere radius as computed by three-forcegraph: cbrt(val) * nodeRelSize
	private nodeRadius = (node: Node) =>
		Math.cbrt(this.nodeVal(node)) * this.display.nodeSize;

	// hubs grow with the number of connections
	private nodeVal = (node: Node) => 1 + this.degree(node);

	private createNodes = () => {
		this.instance
			.nodeRelSize(this.display.nodeSize)
			.nodeVal(this.nodeVal)
			.nodeResolution(20)
			.nodeOpacity(1)
			.nodeColor(this.getNodeColor)
			.nodeLabel((node: Node) =>
				// hover tooltip only when the always-on labels are turned off
				this.display.showLabels ? "" : this.tooltipFor(node)
			)
			.nodeThreeObject(this.createLabel)
			.nodeThreeObjectExtend(true)
			.onNodeHover(this.onNodeHover);
	};

	private tooltipFor(node: Node): string {
		const label = document.createElement("div");
		label.className = "node-label";
		label.textContent = displayName(node);
		return label.outerHTML;
	}

	private hasHighlight = () => this.highlightedNodes.size > 0;

	private getNodeColor = (node: Node): string => {
		const theme = this.theme;
		if (this.hasHighlight()) {
			if (node === this.hoveredNode) return theme.interactiveAccentHover;
			if (this.isHighlightedNode(node))
				// with cluster colors on, keep them so the cluster stays recognizable
				return this.clusterColorOf.size > 0
					? this.baseColor(node)
					: theme.textAccent;
			return ObsidianTheme.withAlpha(theme.textFaint, 0.35);
		}
		return this.baseColor(node);
	};

	// cluster color, then the core graph's type colors; color groups override
	private baseColor(node: Node): string {
		const theme = this.theme;
		const cluster = this.clusterColorOf.get(node.id);
		let color: string;
		if (cluster)
			color =
				node.kind === "unresolved"
					? ObsidianTheme.withAlpha(cluster, 0.5)
					: cluster;
		else if (node.kind === "tag") color = theme.graphTag;
		else if (node.kind === "unresolved") color = theme.graphUnresolved;
		else if (this.degree(node) === 0) color = theme.textFaint;
		else if (node.kind === "attachment") color = theme.graphAttachment;
		else color = theme.graphNode;

		if (node.kind === "note" || node.kind === "attachment")
			this.colorGroups.forEach((group) => {
				if (group.matches(node)) color = group.color;
			});
		return color;
	}

	// A text sprite under each node, drawn with the theme's font and colors
	private createLabel = (node: Node): THREE.Object3D => {
		const group = new THREE.Group();
		// with labels off, only the hovered neighborhood gets labels
		if (!this.display.showLabels && !this.highlightedNodes.has(node.id)) return group;

		const theme = this.theme;
		const text = displayName(node);
		const fontPx = 64;
		const font = `500 ${fontPx}px ${theme.fontInterface}`;
		const pad = 12;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return group;
		ctx.font = font;
		canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
		canvas.height = fontPx + pad * 2;

		ctx.font = font;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		// halo in the background color keeps labels legible over links
		ctx.lineWidth = 10;
		ctx.strokeStyle = theme.backgroundPrimary;
		ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
		ctx.fillStyle = theme.textNormal;
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);

		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		texture.generateMipmaps = false;
		const material = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthWrite: false,
		});
		const sprite = new THREE.Sprite(material);

		const height = this.display.nodeSize * LABEL_SCALE + 2;
		sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
		sprite.position.set(0, -(this.nodeRadius(node) + height * 0.75), 0);
		sprite.renderOrder = 10;

		group.add(sprite);
		this.labels.set(node.id, sprite);
		this.applyLabelHighlight(node.id, sprite);
		return group;
	};

	private rebuildLabels() {
		this.labels.clear();
		// a new accessor makes three-forcegraph purge and rebuild node objects
		this.instance.nodeThreeObject((node: Node) => this.createLabel(node));
	}

	// Labels fade with camera distance, like the 2D graph's text fade threshold
	private updateLabelFade = () => {
		if (this.labels.size === 0) return;
		const camera = this.instance.camera().position;
		const nodes = (this.graph.nodes as Positioned[]).filter(
			(n) => n.x !== undefined
		);
		if (nodes.length === 0) return;

		// graph radius around its centroid
		const c = { x: 0, y: 0, z: 0 };
		nodes.forEach((n) => {
			c.x += n.x ?? 0;
			c.y += n.y ?? 0;
			c.z += n.z ?? 0;
		});
		[c.x, c.y, c.z] = [c.x / nodes.length, c.y / nodes.length, c.z / nodes.length];
		const radius = Math.max(
			...nodes.map((n) =>
				Math.hypot((n.x ?? 0) - c.x, (n.y ?? 0) - c.y, (n.z ?? 0) - c.z)
			)
		);
		const base =
			Math.max(150, radius * LABEL_FADE_RADII) * Math.pow(2, this.display.textFade);
		const byId = new Map(nodes.map((n) => [n.id, n] as [string, Positioned]));

		this.labels.forEach((sprite, id) => {
			const n = byId.get(id);
			if (!n) return;
			// bigger (better-connected) nodes keep their labels from further away
			const scale = Math.min(
				2,
				Math.max(0.6, this.nodeRadius(n) / (this.display.nodeSize * 1.6))
			);
			const start = base * scale;
			const range = start * 0.35;
			const d = Math.hypot(
				camera.x - (n.x ?? 0),
				camera.y - (n.y ?? 0),
				camera.z - (n.z ?? 0)
			);
			this.labelFade.set(id, Math.min(1, Math.max(0, (start + range - d) / range)));
			this.applyLabelHighlight(id, sprite);
		});
	};

	private applyLabelHighlight(nodeId: string, sprite: THREE.Sprite) {
		const material = sprite.material as THREE.SpriteMaterial;
		const highlighted = this.hasHighlight() && this.highlightedNodes.has(nodeId);
		const dimmed = this.hasHighlight() && !highlighted;
		// the hovered neighborhood stays readable at any distance
		const fade = highlighted ? 1 : this.labelFade.get(nodeId) ?? 1;
		material.opacity = (dimmed ? 0.12 : 1) * fade;
		sprite.visible =
			material.opacity > 0.01 && (this.display.showLabels || !dimmed);
	}

	private onNodeHover = (node: Node | null) => {
		if (
			(!node && !this.highlightedNodes.size) ||
			(node && this.hoveredNode === node)
		)
			return;

		this.clearHighlights();

		if (node) {
			this.highlightedNodes.add(node.id);
			this.graph.getLinksWithNode(node.id).forEach((link) => {
				this.highlightedLinks.add(link);
				this.highlightedNodes.add(endpointId(link.source));
				this.highlightedNodes.add(endpointId(link.target));
			});
		}
		const labelsNeedBuilding = !this.display.showLabels && this.hoveredNode !== (node ?? null);
		this.hoveredNode = node ?? null;
		if (labelsNeedBuilding) this.rebuildLabels();
		this.updateHighlight();
		this.onHover?.(this.hoveredNode, this.lastMouseEvent);
	};

	private isHighlightedLink = (link: Link): boolean => {
		return this.highlightedLinks.has(link);
	};

	private isHighlightedNode = (node: Node): boolean => {
		return this.highlightedNodes.has(node.id);
	};

	// ====================== Links ====================== //

	private createLinks = () => {
		this.instance
			.linkWidth((link: Link) =>
				this.isHighlightedLink(link)
					? this.display.linkThickness * 0.6
					: this.display.linkThickness * 0.2
			)
			.linkResolution(8)
			.linkOpacity(1)
			.linkDirectionalArrowLength(() =>
				this.showArrows ? 2 + this.display.linkThickness : 0
			)
			.linkDirectionalArrowRelPos(1)
			.linkDirectionalArrowColor(this.getArrowColor)
			// particles flow along the hovered links
			.linkDirectionalParticles((link: Link) =>
				this.isHighlightedLink(link) ? this.display.particleCount : 0
			)
			.linkDirectionalParticleWidth(this.display.particleSize)
			.linkDirectionalParticleColor(() => this.theme.textAccent)
			.onLinkHover(this.onLinkHover)
			.linkColor(this.getLinkColor);
	};

	private getLinkColor = (link: Link): string => {
		const theme = this.theme;
		if (this.isHighlightedLink(link))
			return ObsidianTheme.withAlpha(theme.textAccent, 0.9);
		return ObsidianTheme.withAlpha(
			theme.textMuted,
			this.hasHighlight() ? 0.06 : 0.3
		);
	};

	private getArrowColor = (link: Link): string => {
		const theme = this.theme;
		if (this.isHighlightedLink(link)) return theme.textAccent;
		return ObsidianTheme.mix(
			theme.textMuted,
			theme.backgroundPrimary,
			this.hasHighlight() ? 0.9 : 0.45
		);
	};

	private onLinkHover = (link: Link | null) => {
		if (this.hoveredNode) return; // nodes take precedence
		this.clearHighlights();

		if (link) {
			this.highlightedLinks.add(link);
			this.highlightedNodes.add(endpointId(link.source));
			this.highlightedNodes.add(endpointId(link.target));
		}
		this.updateHighlight();
	};

	private clearHighlights = () => {
		this.highlightedNodes.clear();
		this.highlightedLinks.clear();
	};

	private updateHighlight() {
		this.labels.forEach((sprite, id) => this.applyLabelHighlight(id, sprite));
		// re-setting the accessors makes three-forcegraph re-evaluate them
		this.instance
			.nodeColor(this.instance.nodeColor())
			.linkColor(this.instance.linkColor())
			.linkWidth(this.instance.linkWidth())
			.linkDirectionalArrowLength(this.instance.linkDirectionalArrowLength())
			.linkDirectionalArrowColor(this.instance.linkDirectionalArrowColor())
			.linkDirectionalParticles(this.instance.linkDirectionalParticles());
	}

	getInstance(): ForceGraph3DInstance {
		return this.instance;
	}
}

// file name without the .md extension
const displayName = (node: Node) => node.name.replace(/\.md$/i, "");
