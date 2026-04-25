import { Plugin, PluginSettingTab, App, Notice } from "obsidian";
import { applyCustomMermaidVersion, forceReRenderAllViews, registerMermaid } from "./register";
import { renderSettingsTab } from "./settings-ui";

export interface MermaidVersionSettings {
	enabled: boolean;
	// Auto-sizing
	autoSizeEnabled: boolean;
	maxWidth: number;
	centered: boolean;
	// Export
	exportEnabled: boolean;
	exportScale: number;
	// Custom version
	customVersionEnabled: boolean;
	customVersionUrl: string;
}

export const DEFAULT_SETTINGS: MermaidVersionSettings = {
	enabled: true,
	autoSizeEnabled: false,
	maxWidth: 0,
	centered: false,
	exportEnabled: true,
	exportScale: 3,
	customVersionEnabled: false,
	customVersionUrl: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
};

export default class MermaidVersionPlugin extends Plugin {
	settings!: MermaidVersionSettings;
	mermaidAutoSizer?: { start(): void; stop(): void };
	mermaidExporter?: { start(): void; stop(): void };
	customVersionLoaded = false;

	async onload() {
		await this.loadSettings();

		if (this.settings.enabled) {
			registerMermaid(this);
		}

		this.addCommand({
			id: "reapply-custom-mermaid",
			name: "Re-apply custom Mermaid version (fetch + re-render)",
			callback: async () => {
				if (!this.settings.customVersionUrl) {
					new Notice("No custom Mermaid URL configured.");
					return;
				}
				const version = await applyCustomMermaidVersion(
					this,
					this.settings.customVersionUrl,
				);
				new Notice(
					version
						? `Re-applied Mermaid ${version}`
						: "Failed to apply custom Mermaid. Check the console.",
				);
			},
		});

		this.addCommand({
			id: "rerender-mermaid",
			name: "Re-render Mermaid diagrams (both modes)",
			callback: async () => {
				if (!this.customVersionLoaded) {
					new Notice("Custom Mermaid isn't loaded yet.");
					return;
				}
				await forceReRenderAllViews(this);
				new Notice("Re-rendered Mermaid diagrams");
			},
		});

		this.addSettingTab(new MermaidVersionSettingTab(this.app, this));
	}

	onunload() {
		if (this.mermaidAutoSizer) {
			this.mermaidAutoSizer.stop();
		}
		if (this.mermaidExporter) {
			this.mermaidExporter.stop();
		}
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<MermaidVersionSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MermaidVersionSettingTab extends PluginSettingTab {
	plugin: MermaidVersionPlugin;

	constructor(app: App, plugin: MermaidVersionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		renderSettingsTab({ plugin: this.plugin, containerEl });
	}
}
