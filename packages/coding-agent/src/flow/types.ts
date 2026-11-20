/** Serializable, evidence-backed project overview shared by the scanner and screens. */
export interface FlowEvidence {
	file: string;
	line: number;
	text: string;
}

export interface FlowNode {
	id: string;
	label: string;
	kind: "entry" | "process" | "store" | "external";
	boundary: "project" | "host" | "network";
	description: string;
	files: string[];
	technologies: string[];
}

export interface FlowEdge {
	id: string;
	source: string;
	target: string;
	label: string;
	kind: "dependency" | "read" | "write" | "network" | "execute" | "input" | "output" | "event";
	confidence: "detected" | "inferred";
	evidence: FlowEvidence[];
	count: number;
}

export interface FlowFile {
	path: string;
	language: string;
	lines: number;
	componentId: string;
}

export interface FlowGraph {
	version: 1;
	project: {
		name: string;
		root: string;
		scannedAt: string;
		gitBranch: string;
		gitCommit?: string;
		fileCount: number;
		lineCount: number;
		durationMs: number;
		languages: string[];
	};
	nodes: FlowNode[];
	edges: FlowEdge[];
	files: FlowFile[];
	warnings: string[];
}
