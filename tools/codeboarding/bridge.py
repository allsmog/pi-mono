#!/usr/bin/env python3
"""Run CodeBoarding's real static engine and write its canonical analysis.json."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Set these before importing upstream, which creates telemetry clients at import time.
os.environ["CODEBOARDING_TELEMETRY"] = "false"
os.environ["DO_NOT_TRACK"] = "1"
os.environ["NPM_CONFIG_IGNORE_SCRIPTS"] = "true"

import static_analyzer
from agents.agent_responses import AnalysisInsights
from agents.content_hash import compute_source_tree_hash
from diagram_analysis.analysis_json import (
    FileCoverageSummary,
    build_unified_analysis_json,
    file_nested_relation_edges,
    parse_unified_analysis,
)
from diagram_analysis.cluster_relations import build_global_relations
from diagram_analysis.file_coverage import FileCoverage
from diagram_analysis.scope_assembly import ScopeAssembler
from diagram_analysis.tree_shape import absorb_single_child_components
from infra.clustering_ids import ROOT_SCOPE_ID
from infra.install import enable_on_demand_install, ensure_tools
from infra.repo_utils.ignore import RepoIgnoreManager
from infra.utils import get_config
from infra.vscode_constants import update_config
from static_analyzer import StaticAnalyzer
from static_analyzer.clustering.models import ClusterGroup, ClusterScopeResult
from static_analyzer.clustering.service import ClusteringService, file_leaf_clusters
from static_analyzer.config import CALLABLE_TYPES, CLASS_TYPES
from static_analyzer.scanner import ProjectScanner
from static_analyzer.workspace_dependencies import install_workspace_dependencies


UPSTREAM_COMMIT = "b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8"
UPSTREAM_VERSION = "0.15.6"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True, help="Repository to analyze")
    parser.add_argument("--output-dir", type=Path, required=True, help="Private output directory")
    parser.add_argument("--depth-cap", type=int, default=3, help="Component hierarchy depth (default: 3)")
    parser.add_argument(
        "--binary-location",
        type=Path,
        default=os.environ.get("PI_CODEBOARDING_TOOLS_DIR"),
        help="Use preinstalled upstream tools from this directory instead of downloading them",
    )
    args = parser.parse_args()
    project = args.project.expanduser().resolve(strict=True)
    if not project.is_dir():
        parser.error("--project must be a directory")
    if importlib.metadata.version("codeboarding") != UPSTREAM_VERSION:
        parser.error(f"This bridge requires CodeBoarding {UPSTREAM_VERSION}; run setup.py again")
    if args.depth_cap < 1:
        parser.error("--depth-cap must be at least 1")
    upstream = Path(static_analyzer.__file__).resolve().parent.parent
    upstream_revision = subprocess.run(
        ["git", "-C", str(upstream), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    if upstream_revision != UPSTREAM_COMMIT:
        parser.error(f"This bridge requires CodeBoarding commit {UPSTREAM_COMMIT}; run setup.py again")

    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stderr)

    # Match upstream CLI behavior for an explicitly supplied tool bundle. This also supports
    # desktop/container environments that share the runtime but have separate home directories.
    if args.binary_location is not None:
        update_config(str(args.binary_location.expanduser().resolve(strict=True)))
    else:
        ensure_tools(languages=[])
        enable_on_demand_install()
    # Upstream installers log download failures and return. Check the resulting executable
    # here so the UI reports the real setup problem before a scanner traceback hides it.
    tokei = get_config("tools")["tokei"]["command"][0]
    if shutil.which(tokei) is None:
        raise RuntimeError(
            "CodeBoarding tool setup did not provide an executable Tokei. "
            "Check the download error above and your network/TLS configuration, or point "
            "PI_CODEBOARDING_TOOLS_DIR at a preinstalled CodeBoarding tool bundle."
        )
    # This upstream helper is opt-in via CODEBOARDING_INSTALL_DEPENDENCIES.
    install_workspace_dependencies(project)
    scanner = ProjectScanner(project)
    scanner.scan()
    source_tree_hash = compute_source_tree_hash(project)
    with tempfile.TemporaryDirectory(prefix="pi-codeboarding-static-") as cache:
        with StaticAnalyzer(project, resident_servers=False) as analyzer:
            # Never unpickle a cache supplied by the repository being inspected.
            results = analyzer.analyze(cache_dir=Path(cache), skip_cache=True, source_sha=source_tree_hash)

    clustering = ClusteringService(repo_dir=project)
    hierarchy = clustering.build_full_hierarchy(results, max_depth=args.depth_cap)
    assembler = ScopeAssembler(project)
    sub_analyses: dict[str, AnalysisInsights] = {}

    def materialize(scope: ClusterScopeResult) -> AnalysisInsights:
        scoped = assembler.build(scope)
        assembler.qualify_source_cluster_ids(scoped, scope.scope_id)
        for group in scope.groups:
            if group.children is not None and group.children.groups:
                sub_analyses[group.group_id] = materialize(group.children)
        return scoped

    analysis = materialize(hierarchy)
    grouping = "affinity"
    tree_spec = clustering.spec.to_dict()
    if len(analysis.components) == 1 and not sub_analyses:
        # The architectural separability gate intentionally leaves some small packages whole.
        # Show its existing file leaves so their genuine calls remain inspectable in the TUI.
        graphs = results.available_cfgs()
        file_scope = ClusterScopeResult(scope_id=ROOT_SCOPE_ID, graphs_by_language=graphs)
        for language, graph in sorted(graphs.items()):
            leaves = file_leaf_clusters(graph)
            for cluster_id, names in leaves.clusters.items():
                members = {name for name in names if graph.nodes[name].type in CALLABLE_TYPES | CLASS_TYPES}
                if not members:
                    continue
                file_path = next(iter(leaves.cluster_to_files[cluster_id]))
                group_id = str(len(file_scope.groups) + 1)
                file_scope.groups.append(
                    ClusterGroup(
                        group_id=group_id,
                        cluster_ids=[int(group_id)],
                        name=Path(file_path).stem,
                        symbol_members_by_language={language: members},
                    )
                )
        if len(file_scope.groups) > 1:
            analysis = assembler.build(file_scope)
            grouping = "file-leaves"
            tree_spec = {}
    analysis.components_relations = build_global_relations(analysis, sub_analyses, results.available_cfgs())
    file_nested_relation_edges(analysis, sub_analyses, project)
    absorbed = absorb_single_child_components(analysis, sub_analyses)
    clustering.spec.reroot(absorbed)
    if grouping == "affinity":
        tree_spec = clustering.spec.to_dict()
    analysis.description = (
        f"CodeBoarding static call graph, grouped by its deterministic {grouping} clustering. "
        "Arrows are resolved source call relationships, not runtime value or taint flows. "
        "No language model was used."
    )
    coverage = FileCoverage(project, RepoIgnoreManager(project)).build(
        {Path(path) for path in scanner.all_text_files},
        {Path(path) for path in results.get_all_source_files()},
    )
    document = build_unified_analysis_json(
        analysis=analysis,
        expandable_components=[],
        repo_name=project.name,
        repo_dir=project,
        source_tree_hash=source_tree_hash,
        depth_cap=args.depth_cap,
        sub_analyses={scope_id: (scope, []) for scope_id, scope in sub_analyses.items()},
        file_coverage_summary=FileCoverageSummary(**coverage["summary"]),
        tree_spec=tree_spec,
    )
    # Use the upstream reader too: this checks the writer's membership/edge invariants.
    parsed = json.loads(document)
    parse_unified_analysis(parsed)
    target = output_dir / "analysis.json"
    target.write_text(document, encoding="utf-8")

    revision = subprocess.run(
        ["git", "-C", str(project), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    provenance = {
        "engine": "CodeBoarding",
        "mode": "static",
        "grouping": grouping,
        "upstream": "https://github.com/CodeBoarding/CodeBoarding",
        "upstreamCommit": UPSTREAM_COMMIT,
        "upstreamVersion": UPSTREAM_VERSION,
        "project": str(project),
        "projectCommit": revision.stdout.strip() if revision.returncode == 0 else None,
        "sourceTreeHash": source_tree_hash,
        "languages": [str(language) for language in results.get_languages()],
        "symbols": sum(len(graph.nodes) for graph in results.available_cfgs().values()),
        "callEdges": sum(len(graph.edges) for graph in results.available_cfgs().values()),
        "referenceEdges": sum(len(graph.reference_edges) for graph in results.available_cfgs().values()),
        "components": sum(len(scope.components) for scope in [analysis, *sub_analyses.values()]),
        "relations": len(parsed["components_relations"]),
        "exportedCallEdges": len(parsed["edges"]),
        "sourceFiles": len(parsed["files"]),
        "llmUsed": False,
    }
    (output_dir / "pi-flow-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"analysis": str(target), **provenance}))


if __name__ == "__main__":
    main()
