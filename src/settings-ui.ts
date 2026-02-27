import { Notice, Setting } from "obsidian";
import type MermaidVersionPlugin from "./main";
import { loadCustomMermaid, reRenderMermaidDiagrams } from "./auto-sizer";
import { setupMermaidAutoSize, stopMermaidAutoSize } from "./register";

interface MermaidSettingsParams {
  plugin: MermaidVersionPlugin;
  containerEl: HTMLElement;
}

export function renderSettingsTab({ plugin, containerEl }: MermaidSettingsParams) {
  const settings = plugin.settings;

  // Enable/Disable toggle (requires reload)
  new Setting(containerEl)
    .setName("Enable plugin")
    .setDesc("Master toggle. Requires Obsidian restart to take effect.")
    .addToggle((toggle) =>
      toggle
        .setValue(settings.enabled)
        .onChange(async (value) => {
          settings.enabled = value;
          await plugin.saveSettings();
          new Notice(value
            ? "Mermaid Version enabled. Restart Obsidian to apply."
            : "Mermaid Version disabled. Restart Obsidian to apply."
          );
        })
    );

  // Custom Mermaid Version section
  renderCustomMermaidSection({ plugin, containerEl });

  // Auto-Size section
  renderAutoSizeSection({ plugin, containerEl });

  // Export section
  renderExportSection({ plugin, containerEl });

  // Usage examples
  renderUsageSection(containerEl);
}

function renderCustomMermaidSection({ plugin, containerEl }: MermaidSettingsParams) {
  new Setting(containerEl).setName("Custom Mermaid version").setHeading();
  containerEl.createEl("p", {
    text: "Override Obsidian's bundled Mermaid with a newer version from CDN. Useful for accessing latest diagram features.",
    cls: "mv-hint",
  });

  const settings = plugin.settings;

  // Show current mermaid version
  const mermaid = window.mermaid;
  const currentVersion = mermaid?.version ?? "unknown";
  const versionDisplay = containerEl.createDiv("mv-version-info");
  versionDisplay.createEl("span", {
    text: `Current Mermaid version: ${currentVersion}`,
  });

  // Enable toggle
  new Setting(containerEl)
    .setName("Use custom Mermaid version")
    .setDesc("Load a custom Mermaid version from CDN instead of Obsidian's bundled version. Requires Obsidian restart to take effect.")
    .addToggle((toggle) =>
      toggle
        .setValue(settings.customVersionEnabled)
        .onChange(async (value) => {
          settings.customVersionEnabled = value;
          await plugin.saveSettings();
          new Notice(value
            ? "Custom Mermaid enabled. Restart Obsidian to apply."
            : "Custom Mermaid disabled. Restart Obsidian to revert to bundled version."
          );
        })
    );

  // CDN URL input
  new Setting(containerEl)
    .setName("Custom version URL")
    .setDesc("Link to the Mermaid library file.")
    .addText((text) =>
      text
        .setPlaceholder("https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.js")
        .setValue(settings.customVersionUrl)
        .onChange(async (value) => {
          settings.customVersionUrl = value.trim();
          await plugin.saveSettings();
        })
    );

  // Common version presets
  const presetUrls = [
    { label: "Latest (11.x)", url: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" },
    { label: "11.12.3", url: "https://cdn.jsdelivr.net/npm/mermaid@11.12.3/dist/mermaid.min.js" },
    { label: "11.4.1 (Obsidian)", url: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js" },
  ];

  const presetContainer = containerEl.createDiv("mv-presets");
  presetContainer.createEl("span", { text: "Quick presets:", cls: "mv-preset-label" });

  presetUrls.forEach((preset) => {
    const btn = presetContainer.createEl("button", {
      text: preset.label,
      cls: "mv-preset-button",
    });
    btn.classList.toggle("mv-preset-active", settings.customVersionUrl === preset.url);
    btn.addEventListener("click", () => {
      void (async () => {
        settings.customVersionUrl = preset.url;
        await plugin.saveSettings();
        // Update text input
        const textInput = containerEl.querySelector('input[placeholder*="cdn.jsdelivr"]') as HTMLInputElement;
        if (textInput) {
          textInput.value = preset.url;
        }
        // Update button states
        presetContainer.querySelectorAll(".mv-preset-button").forEach((b, i) => {
          b.classList.toggle("mv-preset-active", presetUrls[i]?.url === preset.url);
        });
      })();
    });
  });

  // Load now button (for testing without restart)
  new Setting(containerEl)
    .setName("Load custom version now")
    .setDesc("Load the custom Mermaid version immediately and re-render all diagrams. Use this to test before restarting.")
    .addButton((btn) =>
      btn
        .setButtonText("Load & re-render")
        .setCta()
        .onClick(async () => {
          if (!settings.customVersionUrl) {
            new Notice("Please enter a CDN URL first");
            return;
          }

          btn.setDisabled(true);
          btn.setButtonText("Loading...");

          try {
            const version = await loadCustomMermaid(settings.customVersionUrl);
            if (version) {
              // Update version display
              versionDisplay.empty();
              versionDisplay.createEl("span", {
                text: `Current Mermaid version: ${version}`,
              });

              const count = await reRenderMermaidDiagrams();
              new Notice(`Loaded Mermaid ${version}, re-rendered ${count} diagram(s)`);
            } else {
              new Notice("Failed to load custom Mermaid. Check console for details.");
            }
          } catch (err) {
            console.error("Error loading custom mermaid:", err);
            new Notice(`Error: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Load & re-render");
          }
        })
    );

  // Warning note
  const warningEl = containerEl.createDiv("mv-warning");
  warningEl.createEl("strong", { text: "Note: " });
  warningEl.createEl("span", {
    text: "Using a custom Mermaid version may cause compatibility issues with future Obsidian updates. If you experience problems, disable this setting and restart Obsidian.",
  });

  containerEl.createEl("hr");
}

function renderAutoSizeSection({ plugin, containerEl }: MermaidSettingsParams) {
  new Setting(containerEl).setName("Mermaid auto size").setHeading();
  containerEl.createEl("p", {
    text: "Automatically sizes Mermaid diagrams: small ones fit the container, wide ones get horizontal scroll.",
    cls: "mv-hint",
  });

  const settings = plugin.settings;

  // Enable/disable toggle
  new Setting(containerEl)
    .setName("Enable Mermaid auto-sizing")
    .setDesc("Automatically adjust Mermaid diagram sizes based on their content width. Wide diagrams get horizontal scroll, smaller ones fit to container.")
    .addToggle((toggle) =>
      toggle
        .setValue(settings.autoSizeEnabled)
        .onChange(async (value) => {
          settings.autoSizeEnabled = value;
          await plugin.saveSettings();
          if (value) {
            setupMermaidAutoSize(plugin);
          } else {
            stopMermaidAutoSize(plugin);
          }
        })
    );

  // Max width setting with text input
  let maxWidthInput: HTMLInputElement | null = null;

  const applyMaxWidth = async (value: number) => {
    settings.maxWidth = value;
    if (maxWidthInput) {
      maxWidthInput.value = value > 0 ? String(value) : "";
    }
    await plugin.saveSettings();
    // Re-evaluate diagrams with new setting
    if (settings.autoSizeEnabled) {
      stopMermaidAutoSize(plugin);
      setupMermaidAutoSize(plugin);
    }
    // Update preset button states
    updatePresetButtonStates();
  };

  new Setting(containerEl)
    .setName("Maximum diagram width")
    .setDesc("Limit the rendered width of wide diagrams (in pixels). Diagrams that need scrolling will be capped at this width. Set to 0 for no limit.")
    .addText((text) => {
      maxWidthInput = text.inputEl;
      text
        .setPlaceholder("0 (disabled)")
        .setValue(settings.maxWidth > 0 ? String(settings.maxWidth) : "")
        .onChange(async (value) => {
          const parsed = parseInt(value, 10);
          settings.maxWidth = isNaN(parsed) || parsed < 0 ? 0 : parsed;
          await plugin.saveSettings();
          // Re-evaluate diagrams with new setting
          if (settings.autoSizeEnabled) {
            stopMermaidAutoSize(plugin);
            setupMermaidAutoSize(plugin);
          }
          updatePresetButtonStates();
        });
    });

  // Preset buttons for common widths
  const presets = [
    { label: "600px", value: 600 },
    { label: "800px", value: 800 },
    { label: "1000px", value: 1000 },
    { label: "1200px", value: 1200 },
    { label: "None", value: 0 },
  ];

  const presetContainer = containerEl.createDiv("mv-presets");
  presetContainer.createEl("span", { text: "Quick presets:", cls: "mv-preset-label" });

  const presetButtons: HTMLButtonElement[] = [];

  const updatePresetButtonStates = () => {
    presetButtons.forEach((btn, index) => {
      const preset = presets[index];
      if (preset) {
        btn.classList.toggle("mv-preset-active", settings.maxWidth === preset.value);
      }
    });
  };

  presets.forEach((preset) => {
    const btn = presetContainer.createEl("button", {
      text: preset.label,
      cls: "mv-preset-button",
    });
    btn.classList.toggle("mv-preset-active", settings.maxWidth === preset.value);
    btn.addEventListener("click", () => void applyMaxWidth(preset.value));
    presetButtons.push(btn);
  });

  // Center diagrams toggle
  new Setting(containerEl)
    .setName("Center diagrams")
    .setDesc("Center diagrams that fit within the container. Only applies to diagrams that don't require horizontal scrolling.")
    .addToggle((toggle) =>
      toggle
        .setValue(settings.centered)
        .onChange(async (value) => {
          settings.centered = value;
          await plugin.saveSettings();
          // Re-evaluate diagrams with new setting
          if (settings.autoSizeEnabled) {
            stopMermaidAutoSize(plugin);
            setupMermaidAutoSize(plugin);
          }
        })
    );

  // Features description
  new Setting(containerEl).setName("Features").setHeading();

  const featuresList = containerEl.createEl("ul", { cls: "mv-features-list" });

  const features = [
    "Wide diagrams get horizontal scrolling while maintaining natural size",
    "Small diagrams fit to container without stretching",
    "Automatically re-evaluates on window/pane resize",
    "Print-friendly: scales wide diagrams to fit page width",
    "Works in both reading and live preview modes",
  ];

  features.forEach((feature) => {
    featuresList.createEl("li", { text: feature });
  });

  // Status indicator
  if (settings.autoSizeEnabled) {
    const statusEl = containerEl.createDiv("mv-status mv-enabled");
    statusEl.createEl("span", { text: "Mermaid auto-sizing is active", cls: "mv-status-text" });
  } else {
    const statusEl = containerEl.createDiv("mv-status mv-disabled");
    statusEl.createEl("span", { text: "Mermaid auto-sizing is disabled", cls: "mv-status-text" });
  }

  containerEl.createEl("hr");
}

function renderExportSection({ plugin, containerEl }: MermaidSettingsParams) {
  new Setting(containerEl).setName("Mermaid export").setHeading();

  new Setting(containerEl)
    .setName("Enable export button")
    .setDesc("Show a download button on Mermaid diagrams to export as an image, visible on hover.")
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.exportEnabled)
        .onChange(async (value) => {
          plugin.settings.exportEnabled = value;
          await plugin.saveSettings();
          new Notice("Restart Obsidian to apply export button changes.");
        })
    );

  containerEl.createEl("hr");
}

function renderUsageSection(containerEl: HTMLElement) {
  new Setting(containerEl).setName("Usage").setHeading();

  const table = containerEl.createEl("table");
  const thead = table.createEl("thead");
  const headerRow = thead.createEl("tr");
  headerRow.createEl("th", { text: "Option" });
  headerRow.createEl("th", { text: "Description" });

  const tbody = table.createEl("tbody");
  const options = [
    ["Custom Version", "Load a newer Mermaid.js from CDN for latest diagram types"],
    ["Auto-Size", "Automatically fit or scroll diagrams based on width"],
    ["Max Width", "Cap the rendered width of wide diagrams"],
    ["Center", "Center smaller diagrams in the container"],
    ["Export", "PNG export button appears on hover over diagrams"],
  ];

  options.forEach(([option, desc]) => {
    const row = tbody.createEl("tr");
    row.createEl("td", { text: option });
    row.createEl("td", { text: desc });
  });
}
