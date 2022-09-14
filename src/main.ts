import { App, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { Graph3dView } from "./views/graph/Graph3dView";
import GraphSettings, { DEFAULT_SETTINGS } from "./settings/GraphSettings";
import State from "./util/State";
import Graph from "./graph/Graph";
import ObsidianTheme from "./util/ObsidianTheme";
import { NodeGroup } from "./settings/categories/GroupSettings";
import EventBus from "./util/EventBus";
import { ResolvedLinkCache } from "./graph/Link";
import shallowCompare from "./util/ShallowCompare";

export default class Graph3dPlugin extends Plugin {
	// API
	public static app: App;
	settings: GraphSettings;
	_resolvedCache: ResolvedLinkCache;

	// States
	public static settingsState: State<GraphSettings>;
	public static openFileState: State<string | undefined> = new State(
		undefined
	);
	private static cacheIsReady: State<boolean> = new State(false);

	// Other properties
	public static globalGraph: Graph;
	public static theme: ObsidianTheme;
	// Graphs that are waiting for cache to be ready
	private static queuedGraphs: [WorkspaceLeaf, boolean][] = [];
	private callbackUnregisterHandles: (() => void)[] = [];

	async onload() {
		await this.init();
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
		await this.loadSettings();
		this.initStates();
		this.initListeners();
	}

	private initStates() {
		Graph3dPlugin.settingsState = new State<GraphSettings>(this.settings);
		Graph3dPlugin.theme = new ObsidianTheme(this.app.workspace.containerEl);
		Graph3dPlugin.app = this.app;
	}

	private initListeners() {
		this.callbackUnregisterHandles.push(
			// save settings on change
			Graph3dPlugin.settingsState.onChange(() => this.saveSettings())
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

		// when a file gets opened, update the open file state
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) Graph3dPlugin.openFileState.value = file.path;
			})
		);

		this.callbackUnregisterHandles.push(
			// when the cache is ready, open the queued graphs
			Graph3dPlugin.cacheIsReady.onChange((isReady) => {
				if (isReady) {
					this.openQueuedGraphs();
				}
			})
		);

		// all files are resolved, so the cache is ready:
		this.app.metadataCache.on("resolved", this.onGraphCacheReady);
		// the cache changed:
		this.app.metadataCache.on("resolve", this.onGraphCacheChanged);
	}

	// opens all queued graphs (graphs get queued if cache isnt ready yet)
	private openQueuedGraphs() {
		Graph3dPlugin.queuedGraphs.forEach(([leaf, isLocalGraph]) => {
			leaf?.open(new Graph3dView(leaf, isLocalGraph));
		});
		Graph3dPlugin.queuedGraphs = [];
	}

	private onGraphCacheReady = () => {
		Graph3dPlugin.cacheIsReady.value = true;
		this.onGraphCacheChanged();
	};

	private onGraphCacheChanged = () => {
		// check if the cache actually updated
		// Obsidian API sends a lot of (for this plugin) unnecessary stuff
		// with the resolve event
		if (
			Graph3dPlugin.cacheIsReady.value &&
			!shallowCompare(
				this._resolvedCache,
				this.app.metadataCache.resolvedLinks
			)
		) {
			this._resolvedCache = structuredClone(
				this.app.metadataCache.resolvedLinks
			);
			Graph3dPlugin.globalGraph = Graph.createFromApp(this.app);
		}
	};

	private onDoResetSettings = () => {
		Graph3dPlugin.settingsState.value.reset();
		EventBus.trigger("did-reset-settings");
	};

	// Opens a local graph view in a new leaf
	private openLocalGraph = () => {
		const newFilePath = this.app.workspace.getActiveFile()?.path;

		if (newFilePath) {
			Graph3dPlugin.openFileState.value = newFilePath;
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
		const leaf = this.app.workspace.getLeaf(isLocalGraph);
		if (Graph3dPlugin.cacheIsReady.value) {
			leaf?.open(new Graph3dView(leaf, isLocalGraph));
		} else {
			Graph3dPlugin.queuedGraphs.push([leaf, isLocalGraph]);
		}
	};

	// Load the settings as a GraphSettings instance
	private async loadSettings() {
		const loadedData = (await this.loadData()) as GraphSettings,
			defaultSettings = DEFAULT_SETTINGS();

		// Has to be done this way in order to preserve the class structure
		if (loadedData?.display) {
			Object.assign(defaultSettings.display, loadedData.display);
		}
		if (loadedData?.filters) {
			Object.assign(defaultSettings.filters, loadedData.filters);
		}
		if (loadedData?.groups?.groups) {
			defaultSettings.groups.groups = loadedData.groups.groups.map(
				(groupObj) => Object.assign(new NodeGroup("", ""), groupObj)
			);
		}
		this.settings = defaultSettings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		super.onunload();
		this.callbackUnregisterHandles.forEach((handle) => handle());
		EventBus.off("do-reset-settings", this.onDoResetSettings);
	}

	public static getSettings(): GraphSettings {
		return Graph3dPlugin.settingsState.value;
	}
}
