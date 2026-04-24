import { Plugin, PluginSettingTab, App } from "obsidian";
import { registerMermaid } from "./register";
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
	mermaidAutoSizer?: { start(): void; stop(): void; onCustomVersionLoaded(): void };
	mermaidExporter?: { start(): void; stop(): void };
	customVersionLoaded = false;

	async onload() {
		await this.loadSettings();

		if (this.settings.enabled) {
			registerMermaid(this);
		}

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
