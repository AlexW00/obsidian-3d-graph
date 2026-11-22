import { Notice, Plugin, debounce } from "obsidian";
import { Graph3dView } from "./views/graph/Graph3dView";
import GraphSettings from "./settings/GraphSettings";
import State from "./util/State";
import Graph from "./graph/Graph";
import ObsidianTheme from "./util/ObsidianTheme";
import EventBus from "./util/EventBus";
import { CoreGraphOptions, readCoreGraphOptions } from "./util/CoreGraphOptions";
import { brokenLinkKey } from "./settings/categories/FilterSettings";

export default class Graph3dPlugin extends Plugin {
	// filters, groups and forces of Obsidian's 2D graph, kept in sync
	public coreGraphOptions: CoreGraphOptions = {
		search: "",
		showTags: false,
		showAttachments: false,
		hideUnresolved: false,
		showOrphans: true,
		colorGroups: [],
		showArrow: false,
		centerStrength: 0.5,
		repelStrength: 10,
		linkStrength: 1,
		linkDistance: 250,
	};
	private globalGraphSignature = "";

	// States
	public settingsState: State<GraphSettings>;
	public openFileState: State<string | undefined> = new State(undefined);
	private cacheIsReady: State<boolean> = new State(
		this.app.metadataCache.resolvedLinks !== undefined
	);

	// Other properties
	public globalGraph: Graph;
	public theme: ObsidianTheme;
	// Graphs that are waiting for cache to be ready
	private queuedGraphs: Graph3dView[] = [];
	private callbackUnregisterHandles: (() => void)[] = [];

	async onload() {
		await this.init();
		// lets Page Preview show notes when hovering nodes with Cmd/Ctrl held
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(this as any).registerHoverLinkSource?.("3d-graph", {
			display: "3D Graph",
			defaultMod: true,
		});
		this.addRibbonIcon("glasses", "3D Graph", this.openGlobalGraph);
		this.addCommand({
			id: "open-3d-graph-global",
			name: "Open Global 3D Graph",
			callback: this.openGlobalGraph,
		});

		this.addCommand({
			id: "open-3d-graph-local",
			name: "Open Local 3D Graph",
			callback: this.openLocalGraph,
		});
	}

	private async init() {
		await this.initStates();
		this.initListeners();
	}

	private async initStates() {
		const settings = await this.loadSettings();
		this.settingsState = new State<GraphSettings>(settings);
		this.theme = new ObsidianTheme(this.app.workspace.containerEl);
		this.coreGraphOptions = await readCoreGraphOptions(this.app);
		this.cacheIsReady.value =
			this.app.metadataCache.resolvedLinks !== undefined;
		this.rebuildGlobalGraph();
	}

	private initListeners() {
		this.callbackUnregisterHandles.push(
			// save settings on change
			this.settingsState.onChange(() => this.saveSettings())
		);

		// internal event to reset settings to default
		EventBus.on("do-reset-settings", this.onDoResetSettings);

		// show open local graph button in file menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!file) return;
				menu.addItem((item) => {
					item.setTitle("Open in local 3D Graph")
						.setIcon("glasses")
						.onClick(() => this.openLocalGraph());
				});
			})
		);

		// re-read theme colors when the theme or accent color changes
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				this.theme = new ObsidianTheme(this.app.workspace.containerEl);
				EventBus.trigger("theme-changed");
			})
		);

		// when a file gets opened, update the open file state
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) this.openFileState.value = file.path;
			})
		);

		this.callbackUnregisterHandles.push(
			// when the cache is ready, open the queued graphs
			this.cacheIsReady.onChange((isReady) => {
				if (isReady) {
					this.openQueuedGraphs();
				}
			})
		);

		// all files are resolved (after startup and after every change):
		// rebuild the graph, which also picks up tag and file changes
		this.registerEvent(
			this.app.metadataCache.on("resolved", this.onGraphCacheReady)
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.renameHidden(oldPath, file.path);
				this.requestRebuild();
			})
		);
		this.registerEvent(this.app.vault.on("delete", this.requestRebuild));

		// pick up changes made in the 2D graph's controls
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", this.refreshCoreGraphOptions)
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", this.refreshCoreGraphOptions)
		);
	}

	// opens all queued graphs (graphs get queued if cache isnt ready yet)
	private openQueuedGraphs() {
		this.queuedGraphs.forEach((view) => view.showGraph());
		this.queuedGraphs = [];
	}

	private onGraphCacheReady = () => {
		if (this.cacheIsReady.value) {
			this.requestRebuild();
			return;
		}
		// build the graph before views queued while loading open (setting
		// cacheIsReady opens them right away; a debounced build would be late)
		this.buildGlobalGraph();
		this.cacheIsReady.value = true;
	};

	private requestRebuild = debounce(() => this.rebuildGlobalGraph(), 300, true);

	// Rebuilds the vault graph and tells open views, if anything changed
	private rebuildGlobalGraph() {
		if (!this.cacheIsReady.value) return;
		if (this.buildGlobalGraph()) EventBus.trigger("graph-changed");
	}

	// Builds the vault graph; returns whether it changed
	private buildGlobalGraph(): boolean {
		const graph = Graph.createFromApp(this.app);
		const signature = graph.signature();
		if (signature === this.globalGraphSignature) return false;
		this.globalGraphSignature = signature;
		this.globalGraph = graph;
		return true;
	}

	// keeps hidden nodes and broken links attached to a renamed file
	private renameHidden(oldPath: string, newPath: string) {
		const filters = this.settingsState.value.filters;
		const i = filters.hiddenNodes.indexOf(oldPath);
		if (i !== -1) filters.hiddenNodes.splice(i, 1, newPath);
		filters.brokenLinks.forEach((key, j) => {
			const ends = key.split("|");
			if (!ends.includes(oldPath)) return;
			filters.brokenLinks.splice(
				j,
				1,
				brokenLinkKey(...(ends.map((e) => (e === oldPath ? newPath : e)) as [string, string]))
			);
		});
	}

	private refreshCoreGraphOptions = async () => {
		const next = await readCoreGraphOptions(this.app);
		if (JSON.stringify(next) === JSON.stringify(this.coreGraphOptions)) return;
		this.coreGraphOptions = next;
		EventBus.trigger("core-graph-options-changed");
	};

	private onDoResetSettings = () => {
		this.settingsState.value.reset();
		EventBus.trigger("did-reset-settings");
	};

	// Opens a local graph view in a new leaf
	private openLocalGraph = () => {
		const newFilePath = this.app.workspace.getActiveFile()?.path;

		if (newFilePath) {
			this.openFileState.value = newFilePath;
			this.openGraph(true);
		} else {
			new Notice("No file is currently open");
		}
	};

	// Opens a global graph view in the current leaf
	private openGlobalGraph = () => {
		this.openGraph(false);
	};

	// Open a global or local graph
	private openGraph = (isLocalGraph: boolean) => {
		this.refreshCoreGraphOptions();
		const leaf = this.app.workspace.getLeaf(isLocalGraph ? "split" : false);
		const graphView = new Graph3dView(this, leaf, isLocalGraph);
		leaf.open(graphView);
		if (this.cacheIsReady.value) {
			graphView.showGraph();
		} else {
			this.queuedGraphs.push(graphView);
		}
	};

	private async loadSettings(): Promise<GraphSettings> {
		const loadedData = await this.loadData(),
			settings = GraphSettings.fromStore(loadedData);
		return settings;
	}

	async saveSettings() {
		await this.saveData(this.settingsState.getRawValue().toObject());
	}

	onunload() {
		super.onunload();
		this.callbackUnregisterHandles.forEach((handle) => handle());
		EventBus.off("do-reset-settings", this.onDoResetSettings);
	}

	public getSettings(): GraphSettings {
		return this.settingsState.value;
	}
}
