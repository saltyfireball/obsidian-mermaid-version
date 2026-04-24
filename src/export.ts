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

function createPngSvgFallback(svg: SVGElement, backgroundColor: string): string {
	const clone = svg.cloneNode(true) as SVGElement;
	const isDarkMode = document.body.classList.contains("theme-dark");
	const textColor = isDarkMode ? "#dcddde" : "#1e1e1e";
	// The SVG is rasterized standalone via data URI, where Obsidian's @font-face fonts
	// (e.g. Inter) are NOT available. Use the platform UI font stack -- SF Pro on Mac,
	// Segoe UI on Windows, Roboto on Android -- all of which are close in metrics to
	// Inter, so text widths stay close to what mermaid laid out for.
	const safeFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

	if (!clone.getAttribute("xmlns")) {
		clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	}
	clone.setAttribute("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

	// Font substitution on SVG text nodes.
	clone.querySelectorAll("text, tspan").forEach((el) => {
		(el as SVGElement).style.fontFamily = safeFontFamily;
	});

	// Font substitution + overflow-visible on HTML inside foreignObjects.
	clone.querySelectorAll("foreignObject").forEach((fo) => {
		fo.setAttribute("overflow", "visible");
		(fo as unknown as HTMLElement).style.overflow = "visible";
		fo.querySelectorAll("*").forEach((el) => {
			if (el instanceof HTMLElement) {
				el.style.fontFamily = safeFontFamily;
				el.style.overflow = "visible";
				if (!el.style.whiteSpace) {
					el.style.whiteSpace = "nowrap";
				}
			}
		});
	});

	clone.querySelectorAll("style").forEach((styleEl) => {
		if (styleEl.textContent) {
			let css = styleEl.textContent;
			css = css.replace(/var\(--[^)]+\)/g, textColor);
			css = css.replace(/font-family:\s*[^;]+;/g, `font-family: ${safeFontFamily};`);
			styleEl.textContent = css;
		}
	});

	// Ensure arrowhead markers are visible. Handle:
	//  - Missing fill  -> default to textColor (in dark mode) so arrows are visible on dark bg
	//  - var(...)      -> replaced with textColor
	//  - inherit       -> replaced with textColor
	//  - context-stroke / context-fill  -> these keywords often don't resolve when the
	//    SVG is rasterized standalone via data URI, silently hiding the arrowhead
	clone.querySelectorAll("defs marker path, defs marker polygon, defs marker circle").forEach((el) => {
		(["fill", "stroke"] as const).forEach((attr) => {
			const val = el.getAttribute(attr);
			if (val && (val.includes("var(") || val === "inherit" || val.includes("context-"))) {
				el.setAttribute(attr, textColor);
			}
		});
		if (!el.getAttribute("fill")) {
			el.setAttribute("fill", textColor);
		}
		const style = el.getAttribute("style");
		if (style && style.includes("context-")) {
			el.setAttribute("style", style.replace(/context-(stroke|fill)/g, textColor));
		}
	});

	// Strip clip-path refs so nothing accidentally clips the widened labels.
	clone.querySelectorAll("[clip-path]").forEach((el) => {
		el.removeAttribute("clip-path");
	});

	// Temporarily attach clone to DOM (offscreen) so we can measure HTML content
	// widths with the substituted fonts applied.
	const measureHost = document.createElement("div");
	measureHost.style.position = "fixed";
	measureHost.style.top = "-99999px";
	measureHost.style.left = "-99999px";
	measureHost.style.visibility = "hidden";
	measureHost.style.pointerEvents = "none";
	measureHost.appendChild(clone);
	document.body.appendChild(measureHost);

	// Widen each foreignObject to fit its content under the substituted font.
	// NOTE: we intentionally do NOT widen the surrounding node/cluster <rect>.
	// Mermaid routes arrow endpoints to the rect's original geometry; widening
	// the rect would move it past the arrow tips and hide the arrowhead markers
	// behind the widened box. Leaving the rect alone keeps arrows intact.
	// With the platform UI font stack above, text width is close enough to the
	// original that any spill beyond the box is minimal.
	clone.querySelectorAll("foreignObject").forEach((fo) => {
		const foEl = fo as SVGForeignObjectElement;
		const inner = foEl.firstElementChild;
		if (!(inner instanceof HTMLElement)) return;

		const contentWidth = Math.max(inner.scrollWidth, inner.offsetWidth);
		const contentHeight = Math.max(inner.scrollHeight, inner.offsetHeight);
		const currentWidth = parseFloat(foEl.getAttribute("width") || "0");
		const currentHeight = parseFloat(foEl.getAttribute("height") || "0");
		const currentX = parseFloat(foEl.getAttribute("x") || "0");
		const currentY = parseFloat(foEl.getAttribute("y") || "0");

		if (contentWidth > 0 && contentWidth > currentWidth) {
			const newWidth = contentWidth + 4;
			const dx = (newWidth - currentWidth) / 2;
			foEl.setAttribute("width", String(newWidth));
			foEl.setAttribute("x", String(currentX - dx));
		}
		if (contentHeight > 0 && contentHeight > currentHeight) {
			const newHeight = contentHeight + 4;
			const dy = (newHeight - currentHeight) / 2;
			foEl.setAttribute("height", String(newHeight));
			foEl.setAttribute("y", String(currentY - dy));
		}
	});

	let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
	const origViewBox = svg.getAttribute("viewBox");
	if (origViewBox) {
		const parts = origViewBox.split(/[\s,]+/);
		vbX = parseFloat(parts[0] || "0");
		vbY = parseFloat(parts[1] || "0");
		vbW = parseFloat(parts[2] || "0");
		vbH = parseFloat(parts[3] || "0");
	}

	try {
		const bbox = (clone as SVGSVGElement).getBBox();
		if (bbox.width > 0 && bbox.height > 0) {
			const minX = vbW > 0 ? Math.min(vbX, bbox.x) : bbox.x;
			const minY = vbH > 0 ? Math.min(vbY, bbox.y) : bbox.y;
			const maxX = vbW > 0 ? Math.max(vbX + vbW, bbox.x + bbox.width) : bbox.x + bbox.width;
			const maxY = vbH > 0 ? Math.max(vbY + vbH, bbox.y + bbox.height) : bbox.y + bbox.height;
			vbX = minX;
			vbY = minY;
			vbW = maxX - minX;
			vbH = maxY - minY;
		}
	} catch {
		// getBBox can throw if the element isn't rendered; keep viewBox as-is.
	}

	measureHost.removeChild(clone);
	document.body.removeChild(measureHost);

	// Pad generously to absorb any remaining font metric variance.
	const pad = 20;
	if (vbW > 0 && vbH > 0) {
		vbX -= pad;
		vbY -= pad;
		vbW += pad * 2;
		vbH += pad * 2;
		clone.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
		clone.setAttribute("width", String(vbW));
		clone.setAttribute("height", String(vbH));
	}
	clone.setAttribute("overflow", "visible");

	const bgX = vbW > 0 ? String(vbX) : "0";
	const bgY = vbH > 0 ? String(vbY) : "0";
	const bgWidth = vbW > 0 ? String(vbW) : "100%";
	const bgHeight = vbH > 0 ? String(vbH) : "100%";

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

async function createPngSvg(svg: SVGElement, _container: HTMLElement, backgroundColor: string): Promise<string> {
	// Rasterize the already-rendered DOM SVG so the export matches the preview exactly.
	// Re-rendering in a detached context produced a viewBox that cut off text whose
	// width differed under font substitution.
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

function getIntrinsicSvgDimensions(svgString: string): { width: number; height: number } {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, "image/svg+xml");
	const svgEl = doc.querySelector("svg");
	if (!svgEl) return { width: 800, height: 600 };

	const viewBox = svgEl.getAttribute("viewBox");
	if (viewBox) {
		const parts = viewBox.split(/[\s,]+/);
		const w = parseFloat(parts[2] || "0");
		const h = parseFloat(parts[3] || "0");
		if (w > 0 && h > 0) return { width: w, height: h };
	}

	const widthAttr = parseFloat((svgEl.getAttribute("width") || "").replace(/px$/, ""));
	const heightAttr = parseFloat((svgEl.getAttribute("height") || "").replace(/px$/, ""));
	if (widthAttr > 0 && heightAttr > 0) return { width: widthAttr, height: heightAttr };

	return { width: 800, height: 600 };
}

async function svgToPng(svg: SVGElement, container: HTMLElement, backgroundColor: string, scale: number = 2): Promise<Blob> {
	let svgString = await createPngSvg(svg, container, backgroundColor);

	// Use intrinsic SVG dimensions (from viewBox/attributes) rather than the rendered
	// clientWidth/clientHeight, so CSS max-width caps don't degrade export resolution.
	let { width, height } = getIntrinsicSvgDimensions(svgString);
	if (width === 0) {
		const fallback = getSvgDimensions(svg);
		width = fallback.width || 800;
		height = fallback.height || 600;
	}

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

async function exportMermaid(app: App, svg: SVGElement, container: HTMLElement, scale: number): Promise<void> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const filename = `mermaid-${timestamp}.png`;

	try {
		const backgroundColor = getContainerBackgroundColor(container);
		const blob = await svgToPng(svg, container, backgroundColor, scale);

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

function addExportButtonToContainer(app: App, container: HTMLElement, svg: SVGElement, getScale: () => number): void {
	if (container.querySelector(".mv-mermaid-export-btn")) {
		return;
	}

	const btn = createExportButton();
	container.setCssStyles({ position: "relative" });
	container.appendChild(btn);

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		void exportMermaid(app, svg, container, getScale());
	});
}

export class MermaidExporter {
	private app: App;
	private enabled: boolean;
	private getScale: () => number;
	private observer: MutationObserver | null = null;

	constructor(app: App, enabled: boolean, getScale: () => number) {
		this.app = app;
		this.enabled = enabled;
		this.getScale = getScale;
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

			addExportButtonToContainer(this.app, container, svg, this.getScale);
		});
	}
}
