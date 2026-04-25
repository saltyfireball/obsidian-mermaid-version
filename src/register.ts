import { MarkdownView } from "obsidian";
import type MermaidVersionPlugin from "./main";
import { MermaidAutoSizer, loadCustomMermaidViaScriptTag } from "./auto-sizer";
import { MermaidExporter } from "./export";

/**
 * Register the mermaid feature on the plugin.
 * Handles auto-sizing, export buttons, and custom mermaid version loading.
 */
export function registerMermaid(plugin: MermaidVersionPlugin): void {
	if (plugin.settings.customVersionEnabled && plugin.settings.customVersionUrl) {
		loadCustomMermaidVersion(plugin);
	}

	setupMermaidAutoSize(plugin);
	setupMermaidExport(plugin);

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

	plugin.mermaidAutoSizer = new MermaidAutoSizer(plugin, plugin.settings);
	plugin.app.workspace.onLayoutReady(() => {
		plugin.mermaidAutoSizer?.start();
	});
}

export function stopMermaidAutoSize(plugin: MermaidVersionPlugin): void {
	if (plugin.mermaidAutoSizer) {
		plugin.mermaidAutoSizer.stop();
		plugin.mermaidAutoSizer = undefined;
	}
}

export function setupMermaidExport(plugin: MermaidVersionPlugin): void {
	if (!plugin.settings.exportEnabled) {
		return;
	}

	plugin.mermaidExporter = new MermaidExporter(
		plugin.app,
		plugin.settings.exportEnabled,
		() => plugin.settings.exportScale || 2,
	);
	plugin.app.workspace.onLayoutReady(() => {
		plugin.mermaidExporter?.start();
	});
}

export function stopMermaidExport(plugin: MermaidVersionPlugin): void {
	if (plugin.mermaidExporter) {
		plugin.mermaidExporter.stop();
		plugin.mermaidExporter = undefined;
	}
}

/**
 * Force all open markdown views to rebuild so their mermaid diagrams render
 * against the current window.mermaid. Cycles each leaf through its opposite
 * mode and back to the original, so BOTH reading and live-preview caches are
 * invalidated in one pass.
 */
export async function forceReRenderAllViews(plugin: MermaidVersionPlugin): Promise<void> {
	const leaves = plugin.app.workspace.getLeavesOfType("markdown");
	for (const leaf of leaves) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) continue;

		const originalState = leaf.getViewState();
		const inner = originalState.state as Record<string, unknown> | undefined;
		const originalMode = inner?.mode;
		if (!inner || (originalMode !== "preview" && originalMode !== "source")) {
			continue;
		}
		const otherMode = originalMode === "preview" ? "source" : "preview";

		await leaf.setViewState({ type: "empty" });
		await leaf.setViewState({
			...originalState,
			state: { ...inner, mode: otherMode },
		});
		await leaf.setViewState(originalState);
	}
}

/**
 * Load the custom Mermaid version on startup, once the workspace is ready.
 */
function loadCustomMermaidVersion(plugin: MermaidVersionPlugin): void {
	const url = plugin.settings.customVersionUrl;
	if (!url) return;

	plugin.app.workspace.onLayoutReady(async () => {
		await applyCustomMermaidVersion(plugin, url);
	});
}

/**
 * Load and activate a custom Mermaid version: injects the script, sets the
 * loaded flag, and rebuilds open markdown views. Returns the version string
 * or null on failure.
 */
export async function applyCustomMermaidVersion(
	plugin: MermaidVersionPlugin,
	url: string,
): Promise<string | null> {
	const version = await loadCustomMermaidViaScriptTag(url);
	if (!version) {
		console.warn("Failed to load custom Mermaid, falling back to Obsidian's version");
		return null;
	}
	plugin.customVersionLoaded = true;
	await forceReRenderAllViews(plugin);
	return version;
}
