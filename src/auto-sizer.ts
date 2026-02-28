import type MermaidVersionPlugin from "./main";
import type { MermaidVersionSettings } from "./main";

interface PrintBackup {
	svg: SVGElement;
	width: string;
	maxWidth: string;
	minWidth: string;
}

/**
 * Load a custom mermaid version from CDN.
 * Returns the loaded version string, or null if failed.
 */
export async function loadCustomMermaid(url: string): Promise<string | null> {
	const isEsm = url.includes("+esm") || url.includes("/esm/") || url.endsWith(".mjs");
	if (isEsm) {
		console.warn("ESM module URLs are not supported. Please use the UMD build (mermaid.min.js)");
		console.warn("Example: https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js");
		return null;
	}

	return new Promise((resolve) => {
		const existingScript = document.getElementById("mv-custom-mermaid");
		if (existingScript) {
			existingScript.remove();
		}

		const script = document.createElement("script");
		script.id = "mv-custom-mermaid";
		script.src = url;

		script.onload = () => {
			const mermaid = window.mermaid;
			if (mermaid) {
				const version = mermaid.version ?? mermaid.mermaidAPI?.version ?? "unknown";
				resolve(version);
			} else {
				console.error("Mermaid script loaded but window.mermaid not found");
				resolve(null);
			}
		};

		script.onerror = (err) => {
			console.error("Failed to load custom mermaid:", err);
			resolve(null);
		};

		document.head.appendChild(script);
	});
}

/**
 * Re-render all mermaid diagrams on the page.
 * Call this after loading a custom mermaid version.
 */
export async function reRenderMermaidDiagrams(): Promise<number> {
	const mermaid = window.mermaid;
	if (!mermaid) {
		console.warn("Mermaid not available for re-rendering");
		return 0;
	}

	mermaid.initialize({ startOnLoad: false });

	const selectors = [
		".mermaid[data-mermaid]",
		".mermaid:not(.mermaid-processed)",
		"pre.language-mermaid",
		".markdown-preview-view .mermaid",
		".cm-preview-code-block .mermaid",
	];

	const allContainers = new Set<Element>();
	for (const selector of selectors) {
		const found = document.querySelectorAll(selector);
		found.forEach((el) => allContainers.add(el));
	}

	let rendered = 0;

	for (const container of allContainers) {
		let source = container.getAttribute("data-mermaid");

		if (!source) {
			const codeEl = container.querySelector("code");
			if (codeEl) {
				source = codeEl.textContent;
			}
		}

		if (!source && container.tagName === "PRE") {
			source = container.textContent;
		}

		if (!source) {
			continue;
		}

		try {
			const id = `mermaid-rerender-${Date.now()}-${rendered}`;
			const { svg } = await mermaid.render(id, source);
			const parser = new DOMParser();
			const doc = parser.parseFromString(svg, "image/svg+xml");
			const svgEl = doc.documentElement;
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}
			container.appendChild(document.importNode(svgEl, true));
			container.classList.add("mermaid-processed");
			rendered++;
		} catch (err) {
			console.warn("Failed to re-render mermaid diagram:", err);
		}
	}

	return rendered;
}

export class MermaidAutoSizer {
	private plugin: MermaidVersionPlugin;
	private settings: MermaidVersionSettings;
	private observer: MutationObserver | null = null;
	private lazyObserver: MutationObserver | null = null;
	private resizeHandler: (() => void) | null = null;
	private beforePrintHandler: (() => void) | null = null;
	private afterPrintHandler: (() => void) | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private reRenderTimer: ReturnType<typeof setTimeout> | null = null;
	private printBackups: PrintBackup[] | null = null;
	private fullyStarted = false;
	private reRendering = false;

	constructor(plugin: MermaidVersionPlugin, settings: MermaidVersionSettings) {
		this.plugin = plugin;
		this.settings = settings;
	}

	/**
	 * Called when the custom CDN Mermaid version finishes loading.
	 * Re-renders all existing diagrams that were rendered with Obsidian's built-in version.
	 */
	onCustomVersionLoaded(): void {
		const containers = new Set<Element>();
		document.querySelectorAll(".mermaid").forEach((el) => {
			// Only re-render diagrams not already rendered with custom version
			if (el.getAttribute("data-mv-rendered") !== "true") {
				containers.add(el);
			}
		});
		if (containers.size > 0) {
			void this.reRenderContainers(containers);
		}
	}

	start() {
		const hasMermaid = document.querySelector(".mermaid") !== null;

		if (hasMermaid) {
			this.startFullObservation();
		} else {
			this.startLazyObservation();
		}
	}

	private startLazyObservation() {
		this.lazyObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node instanceof HTMLElement) {
						if (node.classList?.contains("mermaid") || node.querySelector?.(".mermaid")) {
							this.lazyObserver?.disconnect();
							this.lazyObserver = null;
							this.startFullObservation();
							return;
						}
					}
					if (node instanceof SVGElement && node.parentElement?.classList?.contains("mermaid")) {
						this.lazyObserver?.disconnect();
						this.lazyObserver = null;
						this.startFullObservation();
						return;
					}
				}
			}
		});

		const workspaceEl = this.plugin.app.workspace.containerEl;
		const targetEl = workspaceEl || document.body;
		this.lazyObserver.observe(targetEl, {
			childList: true,
			subtree: true,
		});
	}

	private startFullObservation() {
		if (this.fullyStarted) return;
		this.fullyStarted = true;

		if (this.plugin.customVersionLoaded) {
			this.onCustomVersionLoaded();
		} else {
			this.sizeMermaidSvgs();
		}

		this.observer = new MutationObserver((mutations) => {
			if (this.reRendering) return;

			const changedContainers = new Set<Element>();
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node instanceof HTMLElement) {
						if (node.classList?.contains("mermaid")) {
							changedContainers.add(node);
						} else if (node.querySelector?.(".mermaid")) {
							node.querySelectorAll(".mermaid").forEach((el) => changedContainers.add(el));
						}
					}
					// Detect SVG replaced inside an existing .mermaid container
					// (live preview re-renders SVG content without re-adding .mermaid)
					if (node instanceof SVGElement && node.parentElement?.classList?.contains("mermaid")) {
						const parent = node.parentElement;
						// Obsidian re-rendered over our custom render; clear marker so we re-render
						parent.removeAttribute("data-mv-rendered");
						changedContainers.add(parent);
					}
				}
				if (mutation.target instanceof HTMLElement) {
					const mermaidEl = mutation.target.closest?.(".mermaid");
					if (mermaidEl) {
						changedContainers.add(mermaidEl);
					}
				}
			}

			if (changedContainers.size > 0) {
				if (this.plugin.customVersionLoaded && window.mermaid) {
					this.debouncedReRender(changedContainers);
				} else {
					this.debouncedSize();
				}
			}
		});

		const workspaceEl = this.plugin.app.workspace.containerEl;
		const targetEl = workspaceEl || document.body;
		this.observer.observe(targetEl, {
			childList: true,
			subtree: true,
		});

		this.resizeHandler = () => {
			this.resetAndResize();
		};
		window.addEventListener("resize", this.resizeHandler);

		this.beforePrintHandler = () => {
			this.prepareForPrint();
		};
		this.afterPrintHandler = () => {
			this.restoreAfterPrint();
		};
		window.addEventListener("beforeprint", this.beforePrintHandler);
		window.addEventListener("afterprint", this.afterPrintHandler);

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("resize", () => {
				this.resetAndResize();
			}),
		);
	}

	stop() {
		if (this.lazyObserver) this.lazyObserver.disconnect();
		if (this.observer) this.observer.disconnect();
		if (this.resizeHandler)
			window.removeEventListener("resize", this.resizeHandler);
		if (this.beforePrintHandler)
			window.removeEventListener("beforeprint", this.beforePrintHandler);
		if (this.afterPrintHandler)
			window.removeEventListener("afterprint", this.afterPrintHandler);
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		if (this.reRenderTimer) clearTimeout(this.reRenderTimer);
		this.fullyStarted = false;
		this.reRendering = false;

		document
			.querySelectorAll(".mermaid-scroll, .mermaid-fit, .mermaid-centered")
			.forEach((el) => {
				el.classList.remove("mermaid-scroll", "mermaid-fit", "mermaid-centered");
			});
		document
			.querySelectorAll(".mermaid > svg[data-auto-sized]")
			.forEach((svg) => {
				svg.removeAttribute("data-auto-sized");
				(svg as SVGElement).style.removeProperty("width");
				(svg as SVGElement).style.removeProperty("max-width");
				(svg as SVGElement).style.removeProperty("min-width");
				(svg as SVGElement).style.removeProperty("height");
				(svg as SVGElement).style.removeProperty("display");
			});
	}

	private debouncedSize() {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.sizeMermaidSvgs();
		}, 100);
	}

	private debouncedReRender(containers: Set<Element>) {
		if (this.reRenderTimer) clearTimeout(this.reRenderTimer);
		this.reRenderTimer = setTimeout(() => {
			void this.reRenderContainers(containers);
		}, 150);
	}

	private async reRenderContainers(containers: Set<Element>): Promise<void> {
		const mermaid = window.mermaid;
		if (!mermaid) return;

		this.reRendering = true;
		mermaid.initialize({ startOnLoad: false });

		let rendered = 0;
		for (const container of containers) {
			// Skip if already re-rendered with custom version
			if (container.getAttribute("data-mv-rendered") === "true") continue;

			let source = container.getAttribute("data-mermaid");
			if (!source) {
				const codeEl = container.querySelector("code");
				if (codeEl) {
					source = codeEl.textContent;
				}
			}
			if (!source && container.tagName === "PRE") {
				source = container.textContent;
			}
			if (!source) continue;

			try {
				const id = `mermaid-lp-${Date.now()}-${rendered}`;
				const { svg } = await mermaid.render(id, source);
				const parser = new DOMParser();
				const doc = parser.parseFromString(svg, "image/svg+xml");
				const svgEl = doc.documentElement;
				while (container.firstChild) {
					container.removeChild(container.firstChild);
				}
				container.appendChild(document.importNode(svgEl, true));
				container.setAttribute("data-mv-rendered", "true");
				rendered++;
			} catch {
				// Custom version also failed - leave Obsidian's render in place
			}
		}

		this.reRendering = false;
		if (rendered > 0) {
			this.debouncedSize();
		}
	}

	private resetAndResize() {
		document
			.querySelectorAll(".mermaid > svg[data-auto-sized]")
			.forEach((svg) => {
				svg.removeAttribute("data-auto-sized");
			});
		this.debouncedSize();
	}

	private sizeMermaidSvgs() {
		document
			.querySelectorAll(".mermaid > svg:not([data-auto-sized])")
			.forEach((svgEl) => {
				const svg = svgEl as SVGElement;
				const container = svg.parentElement;
				if (!container) return;

				const intrinsicWidth = this.getIntrinsicWidth(svg);
				if (!intrinsicWidth || intrinsicWidth <= 0) return;

				svg.setAttribute("data-auto-sized", "true");

				const cs = getComputedStyle(container);
				const padL = parseFloat(cs.paddingLeft) || 0;
				const padR = parseFloat(cs.paddingRight) || 0;
				const containerWidth = container.clientWidth - padL - padR;

				if (containerWidth <= 0) {
					svg.removeAttribute("data-auto-sized");
					return;
				}

				const maxWidthSetting = this.settings.maxWidth;

				if (intrinsicWidth > containerWidth) {
					container.classList.add("mermaid-scroll");
					container.classList.remove("mermaid-fit", "mermaid-centered");

					const renderWidth = maxWidthSetting > 0
						? Math.min(intrinsicWidth, maxWidthSetting)
						: intrinsicWidth;

					this.setSvgStyles(svg, `${renderWidth}px`, "none", `${renderWidth}px`);
				} else {
					container.classList.add("mermaid-fit");
					container.classList.remove("mermaid-scroll");

					if (this.settings.centered) {
						container.classList.add("mermaid-centered");
					} else {
						container.classList.remove("mermaid-centered");
					}

					this.setSvgStyles(svg, `${intrinsicWidth}px`, "100%", "0");
				}
			});
	}

	private setSvgStyles(svg: SVGElement, width: string, maxWidth: string, minWidth: string) {
		const autoVal = "auto";
		const blockVal = "block";
		const important = "important";
		svg.style.setProperty("width", width, important);
		svg.style.setProperty("max-width", maxWidth, important);
		svg.style.setProperty("min-width", minWidth, important);
		svg.style.setProperty("height", autoVal, important);
		svg.style.setProperty("display", blockVal, important);
	}

	private getIntrinsicWidth(svg: SVGElement): number | null {
		const inlineStyle = svg.getAttribute("style") || "";
		const maxWidthMatch = inlineStyle.match(/max-width:\s*([\d.]+)px/);
		if (maxWidthMatch && maxWidthMatch[1]) {
			const w = parseFloat(maxWidthMatch[1]);
			if (!isNaN(w) && w > 0) return w;
		}

		try {
			const svgGraphics = svg as SVGGraphicsElement;
			const bbox = svgGraphics.getBBox();
			if (bbox.width > 0) return bbox.width;
		} catch {
			// getBBox can throw if SVG isn't in DOM yet
		}

		const widthAttr = svg.getAttribute("width");
		if (widthAttr && widthAttr.includes("px")) {
			const w = parseFloat(widthAttr);
			if (!isNaN(w) && w > 0) return w;
		}

		const viewBox = svg.getAttribute("viewBox");
		if (viewBox) {
			const parts = viewBox.split(/[\s,]+/);
			if (parts[2]) {
				const w = parseFloat(parts[2]);
				if (!isNaN(w) && w > 0) return w;
			}
		}

		return null;
	}

	private prepareForPrint() {
		this.printBackups = [];
		document
			.querySelectorAll(".mermaid-scroll > svg[data-auto-sized]")
			.forEach((svgEl) => {
				const svg = svgEl as SVGElement;
				this.printBackups!.push({
					svg,
					width: svg.style.getPropertyValue("width"),
					maxWidth: svg.style.getPropertyValue("max-width"),
					minWidth: svg.style.getPropertyValue("min-width"),
				});
				this.setSvgStyles(svg, "100%", "100%", "0");
			});
	}

	private restoreAfterPrint() {
		if (!this.printBackups) return;
		this.printBackups.forEach(({ svg, width, maxWidth, minWidth }) => {
			this.setSvgStyles(svg, width, maxWidth, minWidth);
		});
		this.printBackups = null;
	}
}
