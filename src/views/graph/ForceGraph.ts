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
import { brokenLinkKey } from "../../settings/categories/FilterSettings";
import { MoteField, MoteStyle } from "./MoteField";

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
const COOLDOWN_MS = 2500;

// The load bounce, like the 2D graph: the settled layout grows out of its
// center on a damped spring, past full size and back (seconds, fractions)
const BOUNCE_START = 0.1; // starting size
const BOUNCE_SECONDS = 1.5;
const BOUNCE_DAMPING = 3; // higher settles faster
const BOUNCE_FREQUENCY = 5.2; // radians per second

// a node pinned in place by the layout (d3's fixed positions)
type PinnedNode = { fx?: number; fy?: number; fz?: number };

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
	// framing: while a new layout settles the camera keeps the whole graph in
	// view, until the layout stops (then one final fit) or the user moves it
	private hasFramedGraph = false;
	private layoutSettled = false;
	private userMovedCamera = false;
	// spring the graph out from its center once it's first on screen
	private pendingBounce = true;
	private bounce: {
		elapsed: number; // seconds of animation shown so far
		last: number; // time of the last step
		center: { x: number; y: number; z: number };
		nodes: { node: Positioned & PinnedNode; x: number; y: number; z: number }[];
	} | null = null;
	private filterTimer = 0;
	private animationTimer = 0;
	private readonly unsubscribers: (() => void)[] = [];
	private motes: MoteField | null = null;
	private moteFrame = 0;
	private lastFrameTime = 0;

	constructor(
		plugin: Graph3dPlugin,
		rootHtmlElement: HTMLElement,
		isLocalGraph: boolean
	) {
		this.rootHtmlElement = rootHtmlElement;
		this.isLocalGraph = isLocalGraph;
		this.plugin = plugin;

		this.createGraph();
		this.startMotes();
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
		// the user took the camera: stop fitting the graph for them
		const onUserCamera = () => (this.userMovedCamera = true);
		controls?.addEventListener?.("start", onUserCamera);

		const resizeObserver = new ResizeObserver(this.onContainerResized);
		resizeObserver.observe(this.rootHtmlElement);

		this.unsubscribers.push(() => {
			EventBus.off("graph-changed", this.onVaultGraphChanged);
			EventBus.off("theme-changed", this.onThemeChanged);
			EventBus.off("core-graph-options-changed", this.onCoreOptionsChanged);
			this.rootHtmlElement.removeEventListener("mousemove", trackMouse);
			controls?.removeEventListener?.("change", this.updateLabelFade);
			controls?.removeEventListener?.("start", onUserCamera);
			resizeObserver.disconnect();
			window.clearTimeout(this.filterTimer);
			window.clearTimeout(this.animationTimer);
		});
	}

	// Stops listening to settings, file and graph changes
	public destroy() {
		this.unsubscribers.forEach((unsubscribe) => unsubscribe());
		this.unsubscribers.length = 0;
		window.cancelAnimationFrame(this.moteFrame);
		this.motes?.dispose();
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
			.cooldownTime(COOLDOWN_MS)
			.onEngineTick(this.onEngineTick)
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

	private get hasSize() {
		return this.rootHtmlElement.offsetWidth > 0 && this.rootHtmlElement.offsetHeight > 0;
	}

	// Moves the camera, keeping its viewing direction, to the closest point
	// from which every node (or those passing `include`) is in view, with a
	// margin for labels. Unlike zoomToFit, which sizes the view for the
	// graph's largest extent in any direction (depth included) and ignores
	// the view's shape, this measures the graph as the camera sees it, so the
	// graph fills the screen.
	private fitCamera(ms: number, include: (node: Node) => boolean = () => true) {
		const nodes = (this.instance.graphData().nodes as Positioned[]).filter(
			(n) => n.x !== undefined && include(n)
		);
		const { offsetWidth: width, offsetHeight: height } = this.rootHtmlElement;
		if (nodes.length === 0 || !width || !height) return;

		// center of the nodes' bounding box
		const lo = [Infinity, Infinity, Infinity];
		const hi = [-Infinity, -Infinity, -Infinity];
		nodes.forEach((n) =>
			[n.x ?? 0, n.y ?? 0, n.z ?? 0].forEach((v, k) => {
				lo[k] = Math.min(lo[k], v);
				hi[k] = Math.max(hi[k], v);
			})
		);
		const c = lo.map((v, k) => (v + hi[k]) / 2);

		// the camera's axes: back (center -> camera), right and up
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const camera = this.instance.camera() as any;
		const pos = camera.position;
		let back = [pos.x - c[0], pos.y - c[1], pos.z - c[2]];
		const bl = Math.hypot(back[0], back[1], back[2]);
		back = bl > 1e-6 ? back.map((v) => v / bl) : [0, 0, 1];
		const worldUp = Math.abs(back[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
		const cross = (a: number[], b: number[]) => [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0],
		];
		let right = cross(worldUp, back);
		const rl = Math.hypot(right[0], right[1], right[2]) || 1;
		right = right.map((v) => v / rl);
		const up = cross(back, right);
		const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

		// view half-angles, less a margin of the view on each side
		const margin = Math.min(width, height) * 0.05 + 12;
		const tanHalfFov = Math.tan((((camera.fov as number) ?? 40) * Math.PI) / 360);
		const tanV = tanHalfFov * Math.max(0.2, 1 - (2 * margin) / height);
		const tanH = tanHalfFov * (width / height) * Math.max(0.2, 1 - (2 * margin) / width);
		// labels hang below the node
		const below = this.display.showLabels ? this.display.nodeSize * LABEL_SCALE + 2 : 0;

		// closest camera distance from which each node fits, sideways and
		// vertically (a node nearer the camera needs more room)
		let distance = 0;
		nodes.forEach((n) => {
			const q = [(n.x ?? 0) - c[0], (n.y ?? 0) - c[1], (n.z ?? 0) - c[2]];
			const r = this.nodeRadius(n) * 1.3;
			const depth = dot(q, back);
			distance = Math.max(
				distance,
				depth + (Math.abs(dot(q, right)) + r) / tanH,
				depth + (Math.abs(dot(q, up)) + r + below) / tanV
			);
		});
		distance = Math.max(distance, 40);
		this.instance.cameraPosition(
			{ x: c[0] + back[0] * distance, y: c[1] + back[1] * distance, z: c[2] + back[2] * distance },
			{ x: c[0], y: c[1], z: c[2] },
			ms
		);
	}

	// Frames the settled layout, then grows it out of its center on a damped
	// spring, past full size and back, like the 2D graph on load. Nodes are
	// pinned along the way, then released into the live layout. Returns
	// false if there's no layout to bounce yet.
	private startBounce(): boolean {
		const nodes = (this.instance.graphData().nodes as (Positioned & PinnedNode)[]).filter(
			(n) => n.x !== undefined
		);
		if (nodes.length === 0) return false;
		this.pendingBounce = false;
		if (nodes.length < 2) return false;
		// the camera stays put; the graph grows to fill it
		this.fitCamera(0);
		const center = { x: 0, y: 0, z: 0 };
		nodes.forEach((n) => {
			center.x += (n.x ?? 0) / nodes.length;
			center.y += (n.y ?? 0) / nodes.length;
			center.z += (n.z ?? 0) / nodes.length;
		});
		this.bounce = {
			elapsed: 0,
			last: performance.now(),
			center,
			nodes: nodes.map((node) => ({ node, x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 })),
		};
		this.stepBounce();
		// keep the layout engine running so the pinned positions are drawn,
		// however slow the frames (the usual cooldown is restored after)
		this.instance.cooldownTime(Infinity).d3ReheatSimulation();
		return true;
	}

	// Moves the pinned nodes along the spring; ends the bounce when it's done
	private stepBounce() {
		const bounce = this.bounce;
		if (!bounce) return;
		// advance at most 1/20 s per frame, so a slow first frame (labels are
		// built at load) doesn't skip the animation
		const now = performance.now();
		bounce.elapsed += Math.min(0.05, (now - bounce.last) / 1000);
		bounce.last = now;
		const t = bounce.elapsed;
		if (t >= BOUNCE_SECONDS) {
			this.endBounce();
			return;
		}
		// 1 - (1 - start) e^(-dt) cos(ft), eased to exactly 1 at the end
		const scale =
			1 -
			(1 - BOUNCE_START) *
				Math.exp(-BOUNCE_DAMPING * t) *
				Math.cos(BOUNCE_FREQUENCY * t) *
				(1 - t / BOUNCE_SECONDS);
		const c = bounce.center;
		bounce.nodes.forEach(({ node, x, y, z }) => {
			node.fx = c.x + (x - c.x) * scale;
			node.fy = c.y + (y - c.y) * scale;
			node.fz = c.z + (z - c.z) * scale;
		});
	}

	// Releases the nodes at their settled positions
	private endBounce() {
		const bounce = this.bounce;
		if (!bounce) return;
		this.bounce = null;
		this.instance.cooldownTime(COOLDOWN_MS);
		bounce.nodes.forEach(({ node, x, y, z }) => {
			Object.assign(node, { x, y, z, vx: 0, vy: 0, vz: 0 });
			delete node.fx;
			delete node.fy;
			delete node.fz;
		});
	}

	private get shouldFollowLayout() {
		return !this.hasFramedGraph && !this.userMovedCamera && this.hasSize;
	}

	// While a new layout settles, keep it all in view
	private onEngineTick = () => {
		this.updateLabelFade();
		if (this.pendingBounce && this.hasSize && this.startBounce()) return;
		// while bouncing the camera holds still and the graph grows into it
		if (this.bounce) this.stepBounce();
		else if (this.shouldFollowLayout) this.fitCamera(0);
	};

	// The layout stopped: one last, smooth fit. A view hidden while loading
	// (e.g. a background tab at startup) is framed when it is first shown.
	private frameGraph = () => {
		this.updateLabelFade();
		this.endBounce();
		this.layoutSettled = true;
		if (!this.shouldFollowLayout) return;
		this.hasFramedGraph = true;
		this.fitCamera(400);
	};

	// the view was resized or shown: match the canvas to it, and frame the
	// graph if that hasn't happened yet
	private onContainerResized = () => {
		if (!this.hasSize) return;
		this.updateDimensions();
		// first shown now (hidden while loading): bounce in, like on load
		if (this.pendingBounce && this.startBounce()) return;
		if (!this.shouldFollowLayout) return;
		this.fitCamera(0);
		if (this.layoutSettled) this.hasFramedGraph = true;
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
		const { hidden, broken } = this.removed();
		graph.links.forEach((link) => {
			const [s, t] = [endpointId(link.source), endpointId(link.target)];
			if (broken.has(brokenLinkKey(s, t))) return;
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
				if (!node || level.has(other) || !this.kindShown(node) || hidden.has(other))
					return;
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

	// Nodes hidden and links broken by the user, in the 3D graph only
	private removed() {
		const f = this.settings.filters;
		return { hidden: new Set(f.hiddenNodes), broken: new Set(f.brokenLinks) };
	}

	// Hides a node from the 3D graph (it stays in the vault)
	public hideNode(node: Node) {
		const hidden = this.settings.filters.hiddenNodes;
		if (!hidden.includes(node.id)) hidden.push(node.id);
	}

	// Removes a link from the 3D graph (the note is not changed)
	public breakLink(link: Link) {
		const key = brokenLinkKey(endpointId(link.source), endpointId(link.target));
		const broken = this.settings.filters.brokenLinks;
		if (!broken.includes(key)) broken.push(key);
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

		const { hidden, broken } = this.removed();
		const shown = new Set<string>();
		this.fullGraph.nodes.forEach((node) => {
			if (node.kind !== "note" && node.kind !== "attachment") return;
			if (hidden.has(node.id) && node.id !== root) return;
			if (!this.kindShown(node)) return;
			if (node.id === root || !search || search(node)) shown.add(node.id);
		});
		const inGraph = new Set(this.fullGraph.nodes.map((n) => n.id));
		this.fullGraph.nodes.forEach((node) => {
			if (node.kind === "note" || node.kind === "attachment") return;
			if (
				this.kindShown(node) &&
				!hidden.has(node.id) &&
				node.neighbors.some(
					(n) =>
						inGraph.has(n.id) &&
						shown.has(n.id) &&
						!broken.has(brokenLinkKey(n.id, node.id))
				)
			)
				shown.add(node.id);
		});

		const links = this.fullGraph.links.filter((link) => {
			const [s, t] = [endpointId(link.source), endpointId(link.target)];
			return shown.has(s) && shown.has(t) && !broken.has(brokenLinkKey(s, t));
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
			item.addEventListener("click", () => {
				// the camera is the user's now; don't fit the whole graph over it
				this.userMovedCamera = true;
				this.fitCamera(600, (n) => cluster.members.has(n.id));
			});
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
		this.endBounce();
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
		this.layoutSettled = false;
		if (reframe) {
			this.hasFramedGraph = false;
			this.userMovedCamera = false;
		}
		this.instance.graphData(graph);
		this.applyForces();
		this.rebuildLabels();
		this.resetMotes();
	}

	// the vault changed: rebuild, but keep the camera where it is
	private onVaultGraphChanged = () => {
		this.setGraphData(this.getGraphData(), false);
	};

	// the local graph's file changed: new graph, reframe
	private onOpenFileChanged = () => {
		// a new local graph bounces in, like a fresh load
		this.pendingBounce = true;
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
		this.pendingBounce = false;
		this.endBounce();
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
			this.resetMotes();
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
		if (path.startsWith("filters.hiddenNodes") || path.startsWith("filters.brokenLinks")) {
			// hiding or breaking something: update in place, keep the camera
			window.clearTimeout(this.filterTimer);
			this.filterTimer = window.setTimeout(() => {
				const data = this.isLocalGraph ? this.getGraphData() : this.filterGraph();
				this.setGraphData(data, false);
			}, 50);
			return;
		}
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
		}

		if (path.startsWith("display.")) this.resetMotes();
		this.updateHighlight(); // re-evaluate colors, widths and arrows
	};

	private onThemeChanged = () => {
		this.resetMotes();
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

	// ====================== Motes ====================== //

	private get isDarkTheme() {
		const m = this.theme.backgroundPrimary.match(/\d+(\.\d+)?/g);
		if (!m) return true;
		const [r, g, b] = m.map(Number);
		return 0.299 * r + 0.587 * g + 0.114 * b < 128;
	}

	private readonly moteStyle: MoteStyle = {
		count: () => this.display.motesPerLink,
		colors: (link: Link) => {
			if (this.isHighlightedLink(link))
				return [this.theme.interactiveAccentHover, this.theme.textAccent];
			const node = (end: string | Node) =>
				typeof end === "string" ? undefined : (end as Node);
			const s = node(link.source);
			const t = node(link.target);
			const fallback = this.theme.textMuted;
			return [s ? this.moteColor(s) : fallback, t ? this.moteColor(t) : fallback];
		},
		brightness: (link: Link) => {
			const highlighted = this.isHighlightedLink(link);
			// in lines mode, motes only show on the hovered links
			if (!this.alwaysParticles) return highlighted ? 1 : 0;
			if (this.hasHighlight()) return highlighted ? 1 : 0.08;
			return 0.9;
		},
		size: 0,
		speed: 0,
		spread: 0,
		solidity: 0,
		coalescence: 0,
		additive: true,
	};

	// node colors for motes, asked for every frame, so cached until the
	// graph, settings, theme or highlight change
	private readonly moteColors = new Map<string, string>();
	private moteColor(node: Node): string {
		let color = this.moteColors.get(node.id);
		if (color === undefined) {
			color = this.baseColor(node);
			this.moteColors.set(node.id, color);
		}
		return color;
	}

	private refreshMoteStyle() {
		this.moteColors.clear();
		this.moteStyle.size = this.display.particleSize * 4.5;
		this.moteStyle.speed = this.display.particleSpeed * 0.06;
		this.moteStyle.spread = this.display.particleArc;
		this.moteStyle.solidity = this.display.particleSolidity;
		this.moteStyle.coalescence = this.display.streamCoalescence;
		// glows add up on dark themes; solid dots should cover what's behind
		this.moteStyle.additive = this.isDarkTheme && this.display.particleSolidity < 0.5;
	}

	private startMotes() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.motes = new MoteField(this.instance.scene() as any);
		this.resetMotes();
		const frame = (now: number) => {
			const dt = this.lastFrameTime ? Math.min(0.05, (now - this.lastFrameTime) / 1000) : 0;
			this.lastFrameTime = now;
			// nothing to draw while the view is in a background tab or minimized
			const shown = !document.hidden && this.rootHtmlElement.offsetParent !== null;
			if (shown)
				this.motes?.update(dt, this.moteStyle, this.rootHtmlElement.offsetHeight || 600);
			this.moteFrame = window.requestAnimationFrame(frame);
		};
		this.moteFrame = window.requestAnimationFrame(frame);
	}

	// lay motes out again for the links on screen
	private resetMotes() {
		this.refreshMoteStyle();
		this.motes?.clearColors();
		this.motes?.setLinks(this.instance.graphData().links as Link[], this.moteStyle);
	}

	// ====================== Links ====================== //

	private get showLines() {
		return this.display.linkStyle !== "particles";
	}

	private get alwaysParticles() {
		return this.display.linkStyle !== "lines";
	}

	private createLinks = () => {
		this.instance
			.linkWidth((link: Link) => {
				if (!this.showLines) return 0;
				return this.isHighlightedLink(link)
					? this.display.linkThickness * 0.6
					: this.display.linkThickness * 0.2;
			})
			.linkResolution(8)
			.linkOpacity(1)
			// straight links: motes draw their own arcs (see MoteField)
			.linkDirectionalArrowLength(() =>
				this.showArrows ? 2 + this.display.linkThickness : 0
			)
			.linkDirectionalArrowRelPos(1)
			.linkDirectionalArrowColor(this.getArrowColor)
			.linkDirectionalParticles(0)
			.onLinkHover(this.onLinkHover)
			.linkColor(this.getLinkColor);
	};

	private getLinkColor = (link: Link): string => {
		const theme = this.theme;
		if (!this.showLines) return "rgba(0, 0, 0, 0)";
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
		if (this.hoveredNode || !this.showLines) return; // nodes take precedence
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
		this.moteColors.clear();
		this.labels.forEach((sprite, id) => this.applyLabelHighlight(id, sprite));
		// re-setting the accessors makes three-forcegraph re-evaluate them
		this.instance
			.nodeColor(this.instance.nodeColor())
			.linkColor(this.instance.linkColor())
			.linkWidth(this.instance.linkWidth())
			.linkDirectionalArrowLength(this.instance.linkDirectionalArrowLength())
			.linkDirectionalArrowColor(this.instance.linkDirectionalArrowColor())
			;
	}

	getInstance(): ForceGraph3DInstance {
		return this.instance;
	}
}

// file name without the .md extension
const displayName = (node: Node) => node.name.replace(/\.md$/i, "");
