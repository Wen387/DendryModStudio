#!/usr/bin/env python3
"""Build a parser-backed Dendry project index.

v0.1 intentionally stays read-only:
- DendryNexus parses .scene.dry structure and source spans.
- Focused indexer modules add project/profile detection, semantic buckets,
  variables, edges, and diagnostics.
- post_event.scene.dry is treated as opaque for semantic overlays.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from indexer.common import *
from indexer.diagnostics import (
    parser_diagnostics,
    post_event_targeted_edges,
    scan_post_event_targeted,
    synthetic_post_event_scene,
)
from indexer.effects import attach_scene_effects
from indexer.graph import GraphBuilder, add_textual_goto_overlay
from indexer.parser import load_parser_index, run_node_parser
from indexer.profiles import normalize_parser_scene, score_profiles
from indexer.semantics import classify_semantics
from indexer.variables import VariableScanner

def build_index(
    root: Path,
    include_excerpts: bool = False,
    excerpt_context_lines: int = 1,
    parser_index: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    info = parse_info(root)
    info_source = parse_info_source(root)
    if parser_index is None:
        parser_index = run_node_parser(root)
    selected_profiles = score_profiles(root, parser_index)
    post_event_summary = scan_post_event_targeted(root)

    scenes = [
        normalize_parser_scene(scene, root, selected_profiles)
        for scene in parser_index.get("scenes", [])
    ]
    attach_scene_effects(root, scenes)
    post_event_scene = synthetic_post_event_scene(post_event_summary)
    if post_event_scene:
        scenes.append(post_event_scene)
        scenes.sort(key=lambda scene: (scene.get("path", ""), scene.get("id", "")))
    graph = GraphBuilder(scenes)
    edges, graph_diagnostics = graph.build()
    post_event_edges, post_event_diagnostics = post_event_targeted_edges(post_event_summary, graph)
    edges.extend(post_event_edges)
    overlay_edges, overlay_diagnostics = add_textual_goto_overlay(root, scenes, edges, graph)
    edges.extend(overlay_edges)

    variable_scanner = VariableScanner(root)
    variables, variable_diagnostics, variable_summary = variable_scanner.scan()
    opaque_blocks_by_path = variable_scanner.opaque_blocks_by_path()
    for scene in scenes:
        rel = scene.get("path")
        if isinstance(rel, str) and rel in opaque_blocks_by_path:
            scene["opaqueJsBlocks"] = opaque_blocks_by_path[rel]
    semantic = classify_semantics(
        root,
        scenes,
        variables,
        selected_profiles,
        post_event_summary,
        route_order_groups=graph.route_order_groups,
        dynamic_key_evidence=variable_scanner.dynamic_key_evidence,
    )

    diagnostics = (
        parser_diagnostics(parser_index, root)
        + graph_diagnostics
        + post_event_diagnostics
        + overlay_diagnostics
        + variable_diagnostics
        + semantic.get("runtimeSurface", {}).get("diagnostics", [])
    )

    by_scene_type = Counter(scene.get("type", "scene") for scene in scenes)
    by_variable_scope = Counter(variable.get("scope", "q") for variable in variables)

    profile_refs = []
    for item in selected_profiles:
        ref = {key: value for key, value in item.items() if not key.startswith("_")}
        profile_refs.append(ref)

    index = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "project": {
            "name": info.get("title", root.name),
            "root": root.as_posix(),
            "engine": "dendrynexus",
            "profileIds": [profile["id"] for profile in profile_refs],
            "sourceRoots": ["source"],
            "info": info,
            "infoSource": info_source,
            "detection": {
                "confidence": CONF_PROFILE,
                "profiles": [
                    {
                        "id": profile["id"],
                        "confidence": profile.get("confidence", 0),
                        "evidence": profile.get("evidence", []),
                    }
                    for profile in profile_refs
                ],
            },
        },
        "profiles": profile_refs,
        "scenes": scenes,
        "edges": edges,
        "variables": variables,
        "semantic": semantic,
        "diagnostics": diagnostics,
        "summary": {
            "sceneCount": len(scenes),
            "edgeCount": len(edges),
            "variableCount": len(variables),
            "diagnosticCount": len(diagnostics),
            "bySceneType": dict(sorted(by_scene_type.items())),
            "byVariableScope": dict(sorted(by_variable_scope.items())),
            "eventCount": len(semantic.get("events", [])),
            "cardCount": len(semantic.get("cards", [])),
            "handCount": len(semantic.get("hands", [])),
            "deckCount": len(semantic.get("decks", [])),
            "pinnedCardCount": len(semantic.get("pinnedCards", [])),
            "newsItemCount": len(semantic.get("news", {}).get("items", [])),
            "eventPopupCount": len(semantic.get("news", {}).get("eventPopups", [])),
            "surfaceTextCount": len(semantic.get("surfaceText", {}).get("items", [])),
            "textCorpusCount": len(semantic.get("textCorpus", {}).get("items", [])),
            "electionResultsCount": len(semantic.get("electionResults", {}).get("items", [])),
            "runtimeSurfaceRegionCount": len(semantic.get("runtimeSurface", {}).get("regions", [])),
            "runtimeSurfaceControlCount": len(semantic.get("runtimeSurface", {}).get("controls", [])),
            "runtimeSurfaceDiagnosticCount": len(semantic.get("runtimeSurface", {}).get("diagnostics", [])),
            "routeOrderGroupCount": len(semantic.get("parserEvidence", {}).get("routeOrderGroups", [])),
            "dynamicKeyEvidenceCount": len(semantic.get("parserEvidence", {}).get("dynamicKeyEvidence", [])),
            "effectClauseCount": len(semantic.get("parserEvidence", {}).get("effectClauses", [])),
            "monthlyPopupRouterCount": len(semantic.get("parserEvidence", {}).get("monthlyPopupRouterTable", [])),
            "effectCount": sum(len(scene.get("effects", [])) for scene in scenes),
            "assetCount": len(semantic.get("assets", {}).get("items", [])),
            "imageAssetCount": len([
                item for item in semantic.get("assets", {}).get("items", [])
                if item.get("type") == "image"
            ]),
            "audioAssetCount": len([
                item for item in semantic.get("assets", {}).get("items", [])
                if item.get("type") == "audio"
            ]),
            **variable_summary,
        },
    }
    index["summary"]["diagnosticCount"] = len(index["diagnostics"])
    if include_excerpts:
        add_source_excerpts(index, root, excerpt_context_lines)
    return index


def render_summary(index: dict[str, Any]) -> str:
    summary = index["summary"]
    profiles = ", ".join(index["project"].get("profileIds", [])) or "(none)"
    lines = [
        f"Project: {index['project']['name']}",
        f"Profiles: {profiles}",
        f"Scenes: {summary['sceneCount']}",
        f"Edges: {summary['edgeCount']}",
        f"Variables: {summary['variableCount']}",
        f"Events/cards/hands/decks/pinned: {summary['eventCount']}/"
        f"{summary['cardCount']}/{summary['handCount']}/{summary['deckCount']}/"
        f"{summary['pinnedCardCount']}",
        f"News items: {summary['newsItemCount']}",
        f"Monthly event popups: {summary.get('eventPopupCount', 0)}",
        f"Surface text items: {summary.get('surfaceTextCount', 0)}",
        f"Text corpus items: {summary.get('textCorpusCount', 0)}",
        f"Election result screens: {summary.get('electionResultsCount', 0)}",
        f"Runtime surface: {summary.get('runtimeSurfaceRegionCount', 0)} regions, "
        f"{summary.get('runtimeSurfaceControlCount', 0)} controls, "
        f"{summary.get('runtimeSurfaceDiagnosticCount', 0)} diagnostics",
        f"Parser evidence: {summary.get('routeOrderGroupCount', 0)} route groups, "
        f"{summary.get('dynamicKeyEvidenceCount', 0)} dynamic Q rows, "
        f"{summary.get('effectClauseCount', 0)} effect clauses, "
        f"{summary.get('monthlyPopupRouterCount', 0)} popup routers",
        f"Assets: {summary.get('assetCount', 0)} "
        f"(images {summary.get('imageAssetCount', 0)}, audio {summary.get('audioAssetCount', 0)})",
        f"Diagnostics: {summary['diagnosticCount']}",
    ]
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a read-only Dendry Mod Studio project index.",
        epilog=(
            "Original SDAAH fixture check: "
            "python3 tools/project_map/build_project_map.py "
            "--fixture-root /path/to/SDAAH --summary "
            "(expected profiles: generic-dendry + sdaah-style)."
        ),
    )
    parser.add_argument("--root", default=".", help="Project root containing source/info.dry.")
    parser.add_argument("--fixture-root", help="Alias for --root when checking an external fixture.")
    parser.add_argument("--out", help="Write project-index JSON to this path. Defaults to stdout.")
    parser.add_argument("--summary", action="store_true", help="Print a compact summary.")
    parser.add_argument(
        "--include-excerpts",
        action="store_true",
        help="Include short source excerpts on source refs for review indexes.",
    )
    parser.add_argument(
        "--excerpt-context-lines",
        type=int,
        default=1,
        help="Number of context lines around each source ref when --include-excerpts is set.",
    )
    parser.add_argument(
        "--parser-index",
        help="Optional parser JSON produced by parse_dry_project.js; used by desktop packaging seams.",
    )
    args = parser.parse_args(argv)
    if args.fixture_root:
        if args.root != ".":
            parser.error("--fixture-root is an alias for --root; use only one.")
        args.root = args.fixture_root
    if args.excerpt_context_lines < 0:
        parser.error("--excerpt-context-lines must be >= 0.")
    if args.excerpt_context_lines > MAX_EXCERPT_CONTEXT_LINES:
        parser.error(f"--excerpt-context-lines must be <= {MAX_EXCERPT_CONTEXT_LINES}.")
    return args


def protected_output_error(root: Path, out_arg: str | None) -> str | None:
    if not out_arg:
        return None
    root = root.resolve()
    out_path = Path(out_arg)
    candidates = [out_path.resolve()]
    if not out_path.is_absolute():
        candidates.append((root / out_path).resolve())
    for candidate in candidates:
        try:
            rel = candidate.relative_to(root).as_posix()
        except ValueError:
            continue
        if is_generated_artifact(rel):
            return (
                "Refusing to write Project Map output under generated artifact path "
                f"{rel}. Use /tmp/dendry_project_map or another non-out/html path."
            )
    return None


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    root = Path(args.root)
    output_error = protected_output_error(root, args.out)
    if output_error:
        print(f"ERROR: {output_error}", file=sys.stderr)
        return 2
    try:
        parser_index = load_parser_index(Path(args.parser_index)) if args.parser_index else None
        index = build_index(
            root,
            include_excerpts=args.include_excerpts,
            excerpt_context_lines=args.excerpt_context_lines,
            parser_index=parser_index,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    text = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        if args.summary:
            print(render_summary(index))
    else:
        sys.stdout.write(text)
        if args.summary:
            print(render_summary(index), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
