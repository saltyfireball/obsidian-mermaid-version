import { App, Notice } from "obsidian";

async function shareOrDownload(input: {
	data: Blob;
	filename: string;
	mimeType: string;
}): Promise<boolean> {
	const file = new File([input.data], input.filename, { type: input.mimeType });

	if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
		try {
			await navigator.share({ files: [file] });
			return true;
		} catch (err) {
			console.warn("Share failed, falling back to download", err);
		}
	}

	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = input.filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return true;
}

function getSvgDimensions(svg: SVGElement): { width: number; height: number; viewBox: string | null } {
	let width = svg.clientWidth || svg.getBoundingClientRect().width;
	let height = svg.clientHeight || svg.getBoundingClientRect().height;
	const viewBox = svg.getAttribute("viewBox");

	if ((width === 0 || height === 0) && viewBox) {
		const parts = viewBox.split(/[\s,]+/);
		width = parseFloat(parts[2] || "800");
		height = parseFloat(parts[3] || "600");
	}

	return { width, height, viewBox };
}

function findMermaidSource(container: HTMLElement): string | null {
	const source = container.getAttribute("data-mermaid");
	if (source) {
		return source;
	}

	let parent = container.parentElement;
	while (parent) {
		const parentSource = parent.getAttribute("data-mermaid");
		if (parentSource) {
			return parentSource;
		}
		const codeBlock = parent.querySelector("pre code, code.language-mermaid");
		if (codeBlock) {
			return codeBlock.textContent || null;
		}
		parent = parent.parentElement;
	}

	return null;
}

let exportCounter = 0;
function generateExportId(): string {
	return `mermaid-export-${Date.now()}-${++exportCounter}`;
}

async function renderMermaidForExport(source: string, backgroundColor: string): Promise<string | null> {
	const mermaid = window.mermaid;
	if (!mermaid) {
		console.warn("Mermaid not available on window");
		return null;
	}

	const isDarkMode = document.body.classList.contains("theme-dark");
	const exportId = generateExportId();

	try {
		const fontFamily = getSafeFontFamily();

		const baseThemeVars = {
			fontFamily: fontFamily,
			fontSize: "14px",
			commitLabelFontSize: "12px",
			tagLabelFontSize: "12px",
		};
		mermaid.initialize({
			startOnLoad: false,
			theme: isDarkMode ? "dark" : "default",
			fontFamily: fontFamily,
			themeVariables: isDarkMode ? {
				...baseThemeVars,
				background: backgroundColor,
				primaryColor: "#4a9eff",
				primaryTextColor: "#ffffff",
				primaryBorderColor: "#4a9eff",
				lineColor: "#dcddde",
				textColor: "#dcddde",
				mainBkg: backgroundColor,
			} : {
				...baseThemeVars,
				background: backgroundColor,
			},
		});

		const { svg } = await mermaid.render(exportId, source);

		const parser = new DOMParser();
		const doc = parser.parseFromString(svg, "image/svg+xml");
		const svgEl = doc.querySelector("svg");

		if (!svgEl) {
			return null;
		}

		const viewBox = svgEl.getAttribute("viewBox");
		let bgX = "0", bgY = "0", bgWidth = "100%", bgHeight = "100%";
		if (viewBox) {
			const parts = viewBox.split(/[\s,]+/);
			bgX = parts[0] || "0";
			bgY = parts[1] || "0";
			bgWidth = parts[2] || "100%";
			bgHeight = parts[3] || "100%";
		}

		const bgRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
		bgRect.setAttribute("x", bgX);
		bgRect.setAttribute("y", bgY);
		bgRect.setAttribute("width", bgWidth);
		bgRect.setAttribute("height", bgHeight);
		bgRect.setAttribute("fill", backgroundColor);
		svgEl.insertBefore(bgRect, svgEl.firstChild);

		if (!svgEl.getAttribute("xmlns")) {
			svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
		}

		const serializer = new XMLSerializer();
		return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svgEl);
	} catch (err) {
		console.error("Error rendering mermaid for export:", err);
		return null;
	}
}

function getSafeFontFamily(): string {
	const bodyStyle = window.getComputedStyle(document.body);
	const rawFont = bodyStyle.getPropertyValue("--font-text").trim()
		|| bodyStyle.getPropertyValue("--font-interface").trim()
		|| bodyStyle.fontFamily
		|| "";

	const hasNonAscii = [...rawFont].some((c) => c.charCodeAt(0) > 127);

	if (hasNonAscii) {
		return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
	}

	const validFonts: string[] = [];
	const fontParts = rawFont.split(",").map((f) => f.trim().replace(/^["']+|["']+$/g, "").trim());

	for (const font of fontParts) {
		if (/^[a-zA-Z0-9\s-]+$/.test(font) && font.length > 1) {
			validFonts.push(font.includes(" ") ? `"${font}"` : font);
		}
	}

	return validFonts.length > 0
		? validFonts.join(", ")
		: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
}

function createPngSvgFallback(svg: SVGElement, backgroundColor: string): string {
	const clone = svg.cloneNode(true) as SVGElement;
	const isDarkMode = document.body.classList.contains("theme-dark");
	const textColor = isDarkMode ? "#dcddde" : "#1e1e1e";
	const safeFontFamily = getSafeFontFamily();

	if (!clone.getAttribute("xmlns")) {
		clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	}
	clone.setAttribute("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

	const viewBox = svg.getAttribute("viewBox");
	let bgX = "0", bgY = "0", bgWidth = "100%", bgHeight = "100%";
	if (viewBox) {
		const parts = viewBox.split(/[\s,]+/);
		bgX = parts[0] || "0";
		bgY = parts[1] || "0";
		bgWidth = parts[2] || "100%";
		bgHeight = parts[3] || "100%";
	}

	clone.querySelectorAll("text, tspan").forEach((el) => {
		(el as SVGElement).style.fontFamily = safeFontFamily;
	});

	clone.querySelectorAll("foreignObject *").forEach((el) => {
		if (el instanceof HTMLElement) {
			el.style.fontFamily = safeFontFamily;
		}
	});

	clone.querySelectorAll("style").forEach((styleEl) => {
		if (styleEl.textContent) {
			let css = styleEl.textContent;
			css = css.replace(/var\(--[^)]+\)/g, textColor);
			css = css.replace(/font-family:\s*[^;]+;/g, `font-family: ${safeFontFamily};`);
			styleEl.textContent = css;
		}
	});

	clone.querySelectorAll("defs marker path, defs marker polygon, defs marker circle").forEach((el) => {
		const fill = el.getAttribute("fill");
		if (!fill || fill.includes("var(") || fill === "inherit") {
			el.setAttribute("fill", textColor);
		}
	});

	const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	bgRect.setAttribute("x", bgX);
	bgRect.setAttribute("y", bgY);
	bgRect.setAttribute("width", bgWidth);
	bgRect.setAttribute("height", bgHeight);
	bgRect.setAttribute("fill", backgroundColor);
	clone.insertBefore(bgRect, clone.firstChild);

	const serializer = new XMLSerializer();
	let svgString = serializer.serializeToString(clone);
	svgString = svgString.replace(/var\(--[^)]+\)/g, textColor);

	return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
}

async function createPngSvg(svg: SVGElement, container: HTMLElement, backgroundColor: string): Promise<string> {
	const source = findMermaidSource(container);
	if (source) {
		const rendered = await renderMermaidForExport(source, backgroundColor);
		if (rendered) {
			return rendered;
		}
	}

	return createPngSvgFallback(svg, backgroundColor);
}

function isTransparentColor(color: string): boolean {
	if (!color) return true;
	const lower = color.toLowerCase();
	if (lower === "transparent") return true;
	if (lower === "rgba(0, 0, 0, 0)") return true;
	const rgbaMatch = lower.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
	if (rgbaMatch && rgbaMatch[1] && parseFloat(rgbaMatch[1]) < 0.1) return true;
	return false;
}

function getContainerBackgroundColor(container: HTMLElement): string {
	const isDarkMode = document.body.classList.contains("theme-dark");
	const defaultColor = isDarkMode ? "#1e1e1e" : "#ffffff";

	const bodyStyle = window.getComputedStyle(document.body);

	let bgPrimary = bodyStyle.getPropertyValue("--background-primary").trim();
	if (bgPrimary && !bgPrimary.startsWith("var(") && bgPrimary !== "" && !isTransparentColor(bgPrimary)) {
		return bgPrimary;
	}

	const bgSecondary = bodyStyle.getPropertyValue("--background-secondary").trim();
	if (bgSecondary && !bgSecondary.startsWith("var(") && bgSecondary !== "" && !isTransparentColor(bgSecondary)) {
		return bgSecondary;
	}

	const rootStyle = window.getComputedStyle(document.documentElement);
	bgPrimary = rootStyle.getPropertyValue("--background-primary").trim();
	if (bgPrimary && !bgPrimary.startsWith("var(") && bgPrimary !== "" && !isTransparentColor(bgPrimary)) {
		return bgPrimary;
	}

	let element: HTMLElement | null = container;
	while (element) {
		const computed = window.getComputedStyle(element);
		const bgColor = computed.backgroundColor;

		if (!isTransparentColor(bgColor)) {
			return bgColor;
		}

		element = element.parentElement;
	}

	return defaultColor;
}

async function svgToPng(svg: SVGElement, container: HTMLElement, backgroundColor: string, scale: number = 2): Promise<Blob> {
	let { width, height } = getSvgDimensions(svg);
	if (width === 0) width = 800;
	if (height === 0) height = 600;

	let svgString = await createPngSvg(svg, container, backgroundColor);

	svgString = svgString.replace(/<image[^>]*xlink:href=["']https?:[^"']*["'][^>]*>/gi, "");
	svgString = svgString.replace(/<image[^>]*href=["']https?:[^"']*["'][^>]*>/gi, "");

	const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = width * scale;
				canvas.height = height * scale;

				const ctx = canvas.getContext("2d");
				if (!ctx) {
					reject(new Error("Could not get canvas context"));
					return;
				}

				ctx.fillStyle = backgroundColor;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0, width, height);

				try {
					canvas.toBlob(
						(blob) => {
							if (blob) {
								resolve(blob);
							} else {
								reject(new Error("Failed to create PNG blob"));
							}
						},
						"image/png",
						1.0,
					);
				} catch (toBlobError) {
					console.error("toBlob error:", toBlobError);
					reject(new Error("Canvas tainted - cannot export this diagram type"));
				}
			} catch (canvasError) {
				console.error("Canvas error:", canvasError);
				reject(canvasError instanceof Error ? canvasError : new Error("Canvas rendering failed"));
			}
		};

		img.onerror = (e) => {
			console.error("SVG load error:", e);
			reject(new Error("Failed to load SVG image"));
		};

		img.crossOrigin = "anonymous";
		img.src = dataUrl;
	});
}

async function exportMermaid(app: App, svg: SVGElement, container: HTMLElement): Promise<void> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const filename = `mermaid-${timestamp}.png`;

	try {
		const backgroundColor = getContainerBackgroundColor(container);
		const blob = await svgToPng(svg, container, backgroundColor, 2);

		await shareOrDownload({
			data: blob,
			filename,
			mimeType: "image/png",
		});

		new Notice(`Downloading: ${filename}`, 3000);
	} catch (err) {
		console.error("Mermaid export error:", err);
		new Notice(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 5000);
	}
}

function createExportButton(): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.className = "mv-mermaid-export-btn";
	btn.setAttribute("aria-label", "Export diagram");

	const svgNs = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNs, "svg");
	svg.setAttribute("xmlns", svgNs);
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");

	const path = document.createElementNS(svgNs, "path");
	path.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
	svg.appendChild(path);

	const polyline = document.createElementNS(svgNs, "polyline");
	polyline.setAttribute("points", "7 10 12 15 17 10");
	svg.appendChild(polyline);

	const line = document.createElementNS(svgNs, "line");
	line.setAttribute("x1", "12");
	line.setAttribute("y1", "15");
	line.setAttribute("x2", "12");
	line.setAttribute("y2", "3");
	svg.appendChild(line);

	btn.appendChild(svg);
	return btn;
}

function addExportButtonToContainer(app: App, container: HTMLElement, svg: SVGElement): void {
	if (container.querySelector(".mv-mermaid-export-btn")) {
		return;
	}

	const btn = createExportButton();
	container.setCssStyles({ position: "relative" });
	container.appendChild(btn);

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		void exportMermaid(app, svg, container);
	});
}

export class MermaidExporter {
	private app: App;
	private enabled: boolean;
	private observer: MutationObserver | null = null;

	constructor(app: App, enabled: boolean) {
		this.app = app;
		this.enabled = enabled;
	}

	start() {
		if (!this.enabled) return;

		this.addExportButtons();

		this.observer = new MutationObserver(() => {
			this.addExportButtons();
		});

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	stop() {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		document.querySelectorAll(".mv-mermaid-export-btn").forEach((btn) => {
			btn.remove();
		});
	}

	private addExportButtons() {
		document.querySelectorAll(".mermaid > svg").forEach((svgEl) => {
			const svg = svgEl as SVGElement;
			const container = svg.parentElement;
			if (!container) return;

			addExportButtonToContainer(this.app, container, svg);
		});
	}
}
