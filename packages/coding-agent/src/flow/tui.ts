/** Native Pi screen for navigating source-derived data-flow diagrams and evidence. */
import {
	type Component,
	type KeybindingsManager,
	replaceControlCharacters,
	sliceByColumn,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { render as renderMermaid } from "lovely-mermaid";
import type { ExtensionContext } from "../core/extensions/types.ts";
import type { Theme } from "../modes/interactive/theme/theme.ts";
import { analyzeProject } from "./analyzer.ts";
import type { FlowEdge, FlowGraph, FlowNode } from "./types.ts";

interface FlowScreenOptions {
	graph: FlowGraph;
	theme: Pick<Theme, "fg" | "bold">;
	keybindings: KeybindingsManager;
	getRows(): number;
	requestRender(): void;
	done(): void;
	rescan(): Promise<FlowGraph>;
	onDispose?(): void;
}

type FlowTab = "components" | "connections" | "actions";
const TABS: FlowTab[] = ["components", "connections", "actions"];

/** Display the graph inside Pi; no browser, HTTP server, or model is involved. */
export async function showProjectFlow(ctx: ExtensionContext, signal?: AbortSignal): Promise<void> {
	const graph = await analyzeProject(ctx.cwd);
	if (signal?.aborted) return;
	await ctx.ui.custom<void>(
		(tui, theme, keybindings, done) => {
			const close = () => screen.close();
			const screen = new ProjectFlowScreen({
				graph,
				theme,
				keybindings,
				getRows: () => tui.terminal.rows,
				requestRender: () => tui.requestRender(),
				done: () => done(undefined),
				rescan: () => analyzeProject(ctx.cwd),
				onDispose: () => signal?.removeEventListener("abort", close),
			});
			signal?.addEventListener("abort", close, { once: true });
			if (signal?.aborted) queueMicrotask(close);
			return screen;
		},
		{ overlay: true, overlayOptions: { width: "100%", maxHeight: "100%", anchor: "top-left" } },
	);
}

/** Full-terminal component, using Pi's configurable selection and navigation keys. */
export class ProjectFlowScreen implements Component {
	readonly capturesViewportInput = true;
	private options: FlowScreenOptions;
	private graph: FlowGraph;
	private nodes: FlowNode[];
	private tab: FlowTab = "components";
	private selected = { components: 0, connections: 0, actions: 0 };
	private dependencies = false;
	private scroll = 0;
	private pan = 0;
	private pageHeight = 12;
	private detailHeight = 0;
	private detailWidth = 0;
	private bodyWidth = 60;
	private busy = false;
	private disposed = false;
	private message = "Select a component to inspect its inputs and outputs.";
	private detailCache: { key: string; lines: string[] } | undefined;

	constructor(options: FlowScreenOptions) {
		this.options = options;
		this.graph = options.graph;
		this.nodes = orderNodes(options.graph.nodes);
		this.selected.components = this.nodes.length ? 1 : 0;
	}

	handleInput(data: string): void {
		if (this.disposed) return;
		const keys = this.options.keybindings;
		if (keys.matches(data, "tui.select.cancel")) {
			this.close();
			return;
		}
		if (keys.matches(data, "tui.input.tab")) {
			this.tab = TABS[(TABS.indexOf(this.tab) + 1) % TABS.length];
			this.resetViewport();
		} else if (keys.matches(data, "tui.select.up") || keys.matches(data, "tui.select.down")) {
			const direction = keys.matches(data, "tui.select.up") ? -1 : 1;
			this.selected[this.tab] = Math.max(0, Math.min(this.items().length - 1, this.selected[this.tab] + direction));
			this.resetViewport();
		} else if (keys.matches(data, "tui.select.pageUp") || keys.matches(data, "tui.select.pageDown")) {
			const direction = keys.matches(data, "tui.select.pageUp") ? -1 : 1;
			this.scroll = Math.max(
				0,
				Math.min(this.detailHeight - this.pageHeight, this.scroll + direction * this.pageHeight),
			);
		} else if (keys.matches(data, "tui.editor.cursorLeft") || keys.matches(data, "tui.editor.cursorRight")) {
			const direction = keys.matches(data, "tui.editor.cursorLeft") ? -1 : 1;
			this.pan = Math.max(0, Math.min(this.detailWidth - this.bodyWidth, this.pan + direction * 8));
		} else if (keys.matches(data, "tui.select.confirm")) {
			this.activate();
		}
		this.options.requestRender();
	}

	render(width: number): string[] {
		const { theme, keybindings } = this.options;
		const w = Math.max(1, width);
		const rows = Math.max(12, this.options.getRows());
		if (w < 45) {
			return ["Pi · Project flow", "Widen the terminal to at least 45 columns.", "Escape returns to Pi."].map(
				(line) => truncateToWidth(line, w),
			);
		}
		const inside = w - 2;
		const sidebarWidth = Math.min(30, Math.max(16, Math.floor(inside * 0.27)));
		const contentWidth = inside - sidebarWidth - 3;
		this.bodyWidth = contentWidth;
		this.pageHeight = rows - 9;
		const details = this.details(contentWidth);
		this.detailHeight = details.length;
		this.detailWidth = Math.max(contentWidth, ...details.map(visibleWidth));
		this.scroll = Math.max(0, Math.min(this.scroll, details.length - this.pageHeight));
		this.pan = Math.max(0, Math.min(this.pan, this.detailWidth - contentWidth));
		const items = this.items();
		const selected = this.selected[this.tab];
		const start = Math.max(0, Math.min(selected - Math.floor(this.pageHeight / 2), items.length - this.pageHeight));
		const row = (text: string) =>
			theme.fg("borderMuted", "│") + fillLine(text, inside) + theme.fg("borderMuted", "│");
		const rule = () => theme.fg("borderMuted", `├${"─".repeat(inside)}┤`);
		const graph = this.graph;
		const lines = [
			theme.fg("borderMuted", `╭${"─".repeat(inside)}╮`),
			row(` ${theme.fg("accent", theme.bold("π  PROJECT FLOW"))}  ${theme.fg("muted", "inside the Pi harness")}`),
			row(
				` ${theme.bold(safe(graph.project.name))}  ${theme.fg("muted", `${safe(graph.project.gitBranch)} · ${graph.project.fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} relationships`)}`,
			),
			row(
				` ${TABS.map((tab) => {
					const label = tab[0].toUpperCase() + tab.slice(1);
					return tab === this.tab
						? theme.fg("accent", theme.bold(`[ ${label} ]`))
						: theme.fg("muted", `  ${label}  `);
				}).join(" ")}  ${theme.fg("dim", this.dependencies ? "dependencies visible" : "I/O relationships")}`,
			),
			rule(),
		];
		for (let i = 0; i < this.pageHeight; i++) {
			const index = start + i;
			const label = items[index] ?? "";
			const item = index === selected && label ? theme.fg("accent", theme.bold(`› ${label}`)) : `  ${label}`;
			const content = details[this.scroll + i] ?? "";
			const clipped = sliceByColumn(content, this.pan, contentWidth);
			lines.push(
				row(`${fillLine(item, sidebarWidth)} ${theme.fg("borderMuted", "│")} ${fillLine(clipped, contentWidth)}`),
			);
		}
		lines.push(rule());
		const keys = (action: Parameters<KeybindingsManager["getKeys"]>[0]) => keybindings.getKeys(action).join("/");
		lines.push(
			row(
				` ${theme.fg("muted", `${keys("tui.input.tab")} views · ${keys("tui.select.up")}/${keys("tui.select.down")} select · ${keys("tui.select.confirm")} inspect/action · ${keys("tui.select.cancel")} return to Pi`)}`,
			),
		);
		const viewport = `PgUp/PgDn scroll · ←/→ pan · ${this.scroll + 1}–${Math.min(details.length, this.scroll + this.pageHeight)}/${details.length}`;
		lines.push(
			row(
				` ${theme.fg(this.busy ? "warning" : "dim", this.busy ? "Rescanning source…" : `Static analysis · ${viewport}`)}`,
			),
		);
		lines.push(theme.fg("borderMuted", `╰${"─".repeat(inside)}╯`));
		return lines;
	}

	invalidate(): void {
		this.detailCache = undefined;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.options.onDispose?.();
	}

	close(): void {
		if (this.disposed) return;
		this.dispose();
		this.options.done();
	}

	private visibleEdges(): FlowEdge[] {
		return this.graph.edges.filter((edge) => this.dependencies || edge.kind !== "dependency");
	}

	private items(): string[] {
		if (this.tab === "components") {
			return [
				"◈ Project overview",
				...this.nodes.map((node) => `${node.boundary === "project" ? "●" : "◇"} ${safe(node.label)}`),
			];
		}
		if (this.tab === "connections") {
			return this.visibleEdges().map(
				(edge, i) => `${String(i + 1).padStart(2, "0")} ${edge.kind} · ${this.label(edge.target)}`,
			);
		}
		return ["Rescan this project", `Dependencies: ${this.dependencies ? "shown" : "hidden"}`, "Return to Pi"];
	}

	private label(id: string): string {
		return safe(this.graph.nodes.find((node) => node.id === id)?.label ?? id);
	}

	private activate(): void {
		if (this.tab === "actions") {
			if (this.selected.actions === 0) void this.rescan();
			else if (this.selected.actions === 1) {
				this.dependencies = !this.dependencies;
				this.selected.connections = 0;
				this.resetViewport();
			} else this.close();
		} else if (this.tab === "components") {
			const node = this.nodes[this.selected.components - 1];
			const edges = this.visibleEdges();
			this.selected.connections = Math.max(
				0,
				edges.findIndex((edge) => edge.source === node?.id || edge.target === node?.id),
			);
			this.tab = "connections";
			this.resetViewport();
		}
	}

	private resetViewport(): void {
		this.scroll = 0;
		this.pan = 0;
		this.invalidate();
	}

	private details(width: number): string[] {
		const key = `${this.tab}:${this.selected[this.tab]}:${this.dependencies}:${width}`;
		if (this.detailCache?.key === key) return this.detailCache.lines;
		const { theme } = this.options;
		const lines: string[] = [];
		if (this.tab === "actions") {
			lines.push(
				theme.fg("accent", theme.bold("PROJECT ANALYSIS")),
				"",
				...wrapTextWithAnsi(safe(this.graph.project.root), width),
			);
			lines.push("", safe(this.message), "", theme.bold("How to read this screen"));
			for (const text of [
				"Components shows the selected component's immediate neighborhood. Enter opens its first connection.",
				"Connections shows every visible relationship, its direction, and the source lines that support it.",
				"Imports are dependencies, not confirmed data flow. Toggle them here to include dashed import edges.",
				"Use PageUp/PageDown to scroll evidence; left/right pans wide diagrams. Escape returns to the coding agent.",
				...this.graph.warnings,
			])
				lines.push("", ...wrapTextWithAnsi(safe(text), width));
		} else if (this.tab === "connections") {
			const edge = this.visibleEdges()[this.selected.connections];
			if (!edge) lines.push("No relationships in this view.", "Use Actions to show dependencies or rescan.");
			else {
				lines.push(theme.fg("accent", theme.bold(`${this.label(edge.source)} → ${this.label(edge.target)}`)));
				lines.push(`${safe(edge.label)} · ${edge.kind} · ${edge.confidence} in source`, "");
				lines.push(
					...this.diagram([edge], [], width),
					"",
					theme.bold(`SOURCE EVIDENCE · ${edge.count} occurrence(s)`),
				);
				lines.push(theme.fg("dim", "Source pattern; not a runtime trace."));
				for (const evidence of edge.evidence) {
					lines.push("", theme.fg("accent", `${safe(evidence.file)}:${evidence.line}`));
					lines.push(...wrapTextWithAnsi(safe(evidence.text), width));
				}
			}
		} else if (this.selected.components === 0) {
			const nodes = this.nodes.slice(0, 24);
			const ids = new Set(nodes.map((node) => node.id));
			const visible = this.visibleEdges();
			const edges = visible.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).slice(0, 48);
			lines.push(theme.fg("accent", theme.bold("PROJECT OVERVIEW")));
			lines.push(
				`${this.graph.nodes.length} nodes · ${visible.length} visible relationships · ${this.graph.project.fileCount} files`,
				"",
			);
			lines.push(
				...this.diagram(
					edges,
					[],
					width,
					nodes.map((node) => node.id),
				),
			);
			if (nodes.length < this.nodes.length || edges.length < visible.length) {
				lines.push(
					"",
					theme.fg(
						"warning",
						`Overview shows ${nodes.length}/${this.nodes.length} nodes and ${edges.length}/${visible.length} relationships. All remain selectable in the lists.`,
					),
				);
			}
			lines.push(
				"",
				...wrapTextWithAnsi(
					"This is the project graph. Select an individual component for its focused neighborhood, or Connections for source evidence. Actions controls whether import dependencies are visible.",
					width,
				),
			);
		} else {
			const node = this.nodes[this.selected.components - 1];
			if (!node) lines.push("No supported source files found.", "Use Actions to review scan limits or rescan.");
			else {
				const edges = this.visibleEdges().filter((edge) => edge.source === node.id || edge.target === node.id);
				lines.push(
					theme.fg("accent", theme.bold(safe(node.label))),
					`${node.boundary} boundary · ${node.kind} · ${node.files.length} source files`,
				);
				lines.push("", ...this.diagram(edges.slice(0, 8), [node.id], width));
				if (edges.length > 8)
					lines.push(
						theme.fg("warning", `Diagram shows 8 of ${edges.length} relationships; Connections lists all.`),
					);
				lines.push(
					"",
					...wrapTextWithAnsi(safe(node.description), width),
					"",
					theme.bold(`CONNECTIONS · ${edges.length}`),
				);
				for (const edge of edges) {
					lines.push("", `${this.label(edge.source)} → ${this.label(edge.target)}  [${edge.kind}]`);
					const evidence = edge.evidence[0];
					if (evidence) lines.push(theme.fg("dim", `${safe(evidence.file)}:${evidence.line}`));
				}
				if (node.files.length) lines.push("", theme.bold("SOURCE FILES"), ...node.files.map((file) => safe(file)));
			}
		}
		this.detailCache = { key, lines };
		return lines;
	}

	private diagram(edges: FlowEdge[], focus: string[], width: number, includedIds: string[] = focus): string[] {
		const ids = [...new Set([...includedIds, ...focus, ...edges.flatMap((edge) => [edge.source, edge.target])])];
		const names = new Map(ids.map((id, i) => [id, `n${i}`]));
		const declarations = ids.map((id) => {
			const label = this.label(id)
				.replace(/["\\[\]{}<>|;]/g, " ")
				.slice(0, 24);
			return `${names.get(id)}["${label}"]${focus.includes(id) ? ":::focus" : ""}`;
		});
		const relationships = edges.map(
			(edge) =>
				`${names.get(edge.source)} ${edge.kind === "dependency" ? "-.->" : "-->"}|${edge.kind}| ${names.get(edge.target)}`,
		);
		const source = [...declarations, ...relationships].join("\n");
		let art = renderMermaid(`flowchart LR\n${source}`);
		if (art && art.width > width) {
			const vertical = renderMermaid(`flowchart TD\n${source}`);
			if (vertical && vertical.width < art.width) art = vertical;
		}
		if (!art) return ["No diagram available for this selection."];
		const { theme } = this.options;
		const lines = art.styled.map((row) =>
			row
				.map((span) => {
					if (span.classes?.includes("focus")) return theme.fg("accent", theme.bold(span.text));
					if (span.role === "edge") return theme.fg("accent", span.text);
					if (span.role === "border") return theme.fg("borderMuted", span.text);
					if (span.role === "edgeLabel") return theme.fg("warning", span.text);
					return span.text;
				})
				.join(""),
		);
		if (art.width > width) lines.unshift(theme.fg("dim", `Diagram is ${art.width} columns wide; ←/→ pans.`));
		if (art.warnings.length) lines.push(...art.warnings.map((warning) => theme.fg("warning", safe(warning))));
		return lines;
	}

	private async rescan(): Promise<void> {
		if (this.busy || this.disposed) return;
		this.busy = true;
		this.options.requestRender();
		try {
			const graph = await this.options.rescan();
			if (this.disposed) return;
			const previous = this.nodes[this.selected.components - 1]?.id;
			this.graph = graph;
			this.nodes = orderNodes(graph.nodes);
			this.selected.components = previous
				? Math.max(0, this.nodes.findIndex((node) => node.id === previous) + 1)
				: 0;
			this.selected.connections = 0;
			this.message = `Rescanned ${graph.project.fileCount} files in ${graph.project.durationMs} ms.`;
		} catch (error) {
			this.message = `Scan failed: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			this.busy = false;
			if (!this.disposed) {
				this.resetViewport();
				this.options.requestRender();
			}
		}
	}
}

function orderNodes(nodes: FlowNode[]): FlowNode[] {
	return [...nodes].sort((left, right) => {
		const rank = (node: FlowNode) => (node.boundary !== "project" ? 2 : node.kind === "entry" ? 0 : 1);
		return rank(left) - rank(right) || left.label.localeCompare(right.label);
	});
}

function safe(text: string): string {
	return replaceControlCharacters(text);
}

function fillLine(text: string, width: number): string {
	const value = truncateToWidth(text, width);
	return value + " ".repeat(Math.max(0, width - visibleWidth(value)));
}
