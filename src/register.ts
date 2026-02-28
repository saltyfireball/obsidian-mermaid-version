import type MermaidVersionPlugin from "./main";
import { MermaidAutoSizer, loadCustomMermaid, reRenderMermaidDiagrams } from "./auto-sizer";
import { MermaidExporter } from "./export";

/**
 * Register the mermaid feature on the plugin.
 * Handles auto-sizing, export buttons, and custom mermaid version loading.
 */
export function registerMermaid(plugin: MermaidVersionPlugin): void {
	// Load custom mermaid version if enabled
	if (plugin.settings.customVersionEnabled && plugin.settings.customVersionUrl) {
		loadCustomMermaidVersion(plugin);
	}

	// Setup auto-sizing if enabled
	setupMermaidAutoSize(plugin);

	// Setup export button if enabled
	setupMermaidExport(plugin);

	// Cleanup on plugin unload
	plugin.register(() => {
		if (plugin.mermaidAutoSizer) {
			plugin.mermaidAutoSizer.stop();
		}
		if (plugin.mermaidExporter) {
			plugin.mermaidExporter.stop();
		}
	});
}

/**
 * Setup Mermaid auto-sizing.
 * Exported so settings-ui can call it for hot-reload toggles.
 */
export function setupMermaidAutoSize(plugin: MermaidVersionPlugin): void {
	if (!plugin.settings.autoSizeEnabled) {
		return;
	}

	plugin.mermaidAutoSizer = new MermaidAutoSizer(
		plugin,
		plugin.settings,
	);
	plugin.app.workspace.onLayoutReady(() => {
		plugin.mermaidAutoSizer?.start();
	});
}

/**
 * Stop Mermaid auto-sizing.
 * Exported so settings-ui can call it for hot-reload toggles.
 */
export function stopMermaidAutoSize(plugin: MermaidVersionPlugin): void {
	if (plugin.mermaidAutoSizer) {
		plugin.mermaidAutoSizer.stop();
		plugin.mermaidAutoSizer = undefined;
	}
}

/**
 * Setup Mermaid export button.
 * Exported so settings-ui can call it for hot-reload toggles.
 */
export function setupMermaidExport(plugin: MermaidVersionPlugin): void {
	if (!plugin.settings.exportEnabled) {
		return;
	}

	plugin.mermaidExporter = new MermaidExporter(
		plugin.app,
		plugin.settings.exportEnabled,
	);
	plugin.app.workspace.onLayoutReady(() => {
		plugin.mermaidExporter?.start();
	});
}

/**
 * Stop Mermaid export.
 * Exported so settings-ui can call it for hot-reload toggles.
 */
export function stopMermaidExport(plugin: MermaidVersionPlugin): void {
	if (plugin.mermaidExporter) {
		plugin.mermaidExporter.stop();
		plugin.mermaidExporter = undefined;
	}
}

/**
 * Re-render diagrams with retries to handle diagrams not yet in the DOM.
 */
async function reRenderWithRetry(plugin: MermaidVersionPlugin): Promise<void> {
	const delays = [0, 500, 1500, 3000, 6000];
	for (const delay of delays) {
		if (delay > 0) {
			await new Promise((r) => setTimeout(r, delay));
		}
		const count = await reRenderMermaidDiagrams();
		if (count > 0) {
			plugin.mermaidAutoSizer?.onCustomVersionLoaded();
			return;
		}
	}
	// Final fallback: notify auto-sizer so its observer handles future diagrams
	plugin.mermaidAutoSizer?.onCustomVersionLoaded();
}

/**
 * Load custom mermaid version from CDN.
 */
function loadCustomMermaidVersion(plugin: MermaidVersionPlugin): void {
	const url = plugin.settings.customVersionUrl;
	if (!url) return;

	// Load after workspace is ready so Obsidian's mermaid has loaded first
	plugin.app.workspace.onLayoutReady(async () => {
		const version = await loadCustomMermaid(url);
		if (version) {
			plugin.customVersionLoaded = true;
			// Re-render diagrams, retrying since they may not be in the DOM yet
			await reRenderWithRetry(plugin);
		} else {
			console.warn("Failed to load custom Mermaid, falling back to Obsidian's version");
		}
	});
}
