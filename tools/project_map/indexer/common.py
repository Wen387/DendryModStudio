#!/usr/bin/env python3
"""Build a parser-backed Dendry project index.

v0.1 intentionally stays read-only:
- DendryNexus parses .scene.dry structure and source spans.
- Python adds project/profile detection, semantic buckets, variables, edges,
  and diagnostics.
- post_event.scene.dry is treated as opaque for semantic overlays.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import fnmatch
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "0.1"
CONF_EXACT = "exact"
CONF_STATIC = "static_inferred"
CONF_PROFILE = "profile_heuristic"
CONF_OPAQUE = "opaque"

SCRIPT_DIR = Path(__file__).resolve().parent.parent
PROFILE_DIR = SCRIPT_DIR / "profiles"
PARSER_WRAPPER = SCRIPT_DIR / "parse_dry_project.js"
POST_EVENT_REL = "source/scenes/post_event.scene.dry"
MAX_EXCERPT_LINE_CHARS = 180
MAX_EXCERPT_CONTEXT_LINES = 5
MAX_POST_EVENT_TARGETED_LINES = 8000
GENERATED_ARTIFACT_EXACT = {"out/game.json"}
GENERATED_ARTIFACT_PREFIXES = ("out/html/",)
SURFACE_TEXT_SOURCE_PATTERNS = (
    "source/qdisplays/**/*.qdisplay.dry",
    "source/scenes/root.scene.dry",
    "source/scenes/status*.scene.dry",
)
SURFACE_TEXT_HTML_EVIDENCE = (
    "out/html/index.html",
    "out/html/sidebar-ui.js",
    "out/html/strategy-sidebar.js",
    "out/html/header-ui.js",
)
SURFACE_TEXT_MAX_ITEMS = 500
SURFACE_TEXT_MAX_FILE_CHARS = 262144
IMAGE_ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
AUDIO_ASSET_EXTENSIONS = {".mp3", ".ogg", ".wav", ".flac", ".m4a"}
MEDIA_ASSET_EXTENSIONS = IMAGE_ASSET_EXTENSIONS | AUDIO_ASSET_EXTENSIONS
ASSET_SCAN_ROOTS = (
    "assets",
    "source/assets",
    "source/images",
    "source/audio",
    "out/html",
)
TEXT_CORPUS_MAX_ITEMS = 15000
TEXT_CORPUS_VISIBLE_METADATA = {
    "title": "title",
    "subtitle": "subtitle",
    "unavailableSubtitle": "unavailable_text",
    "unavailableText": "unavailable_text",
}
DENDRY_BUILTIN_SCENES = {
    "jumpScene",
    "prevScene",
    "prevTopScene",
    "backSpecialScene",
    "returnScene",
}

TIMELINE_FIELD_NAMES = (
    "year",
    "month",
    "monthStart",
    "monthEnd",
    "startYear",
    "endYear",
    "yearStart",
    "yearEnd",
    "startMonth",
    "endMonth",
    "day",
    "week",
    "turn",
    "chapter",
    "phase",
)

RESERVED_CONDITION_WORDS = {
    "if",
    "and",
    "or",
    "not",
    "true",
    "false",
    "undefined",
    "null",
    "Math",
    "floor",
    "round",
    "ceil",
    "min",
    "max",
}


def posix_rel(path: Path | str, root: Path) -> str:
    p = Path(path)
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except Exception:
        return p.as_posix()


def is_generated_artifact(rel: str) -> bool:
    rel = rel.replace("\\", "/")
    return rel in GENERATED_ARTIFACT_EXACT or any(
        rel.startswith(prefix) for prefix in GENERATED_ARTIFACT_PREFIXES
    )


def read_text_prefix(path: Path, limit: int = 131072) -> str:
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        return handle.read(limit)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_profiles() -> list[dict[str, Any]]:
    profiles = []
    for path in sorted(PROFILE_DIR.glob("*.json")):
        profile = load_json(path)
        profile["_path"] = path.as_posix()
        profiles.append(profile)
    return sorted(profiles, key=lambda p: (p.get("priority", 0), p.get("id", "")))


def normalize_metadata_paths(value: Any, root: Path) -> Any:
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, child in value.items():
            if key in {"path", "$file"} and isinstance(child, str):
                out[key] = posix_rel(child, root)
            else:
                out[key] = normalize_metadata_paths(child, root)
        return out
    if isinstance(value, list):
        return [normalize_metadata_paths(child, root) for child in value]
    return value


def source_ref(path: str, line: int | None = None) -> dict[str, Any]:
    ref: dict[str, Any] = {"path": path}
    if line and line > 0:
        ref["line"] = line
    return ref


def source_range_ref(path: str, start_line: int | None = None,
                     end_line: int | None = None) -> dict[str, Any]:
    ref = source_ref(path, start_line)
    if start_line and start_line > 0:
        ref["startLine"] = start_line
    if end_line and end_line > 0:
        ref["endLine"] = end_line
    elif start_line and start_line > 0:
        ref["endLine"] = start_line
    return ref


def span_ref(path: str, span: dict[str, Any] | None) -> dict[str, Any]:
    out: dict[str, Any] = {"path": path}
    if span:
        start = span.get("startLine")
        end = span.get("endLine")
        if start:
            out["startLine"] = start
        if end:
            out["endLine"] = end
    return out


def line_from_span(span: dict[str, Any] | None) -> int | None:
    if not span:
        return None
    return span.get("startLine") or span.get("line")


def source_ref_line(ref: dict[str, Any]) -> int | None:
    line = ref.get("line") or ref.get("startLine")
    if isinstance(line, int) and line > 0:
        return line
    return None


def truncate_excerpt_line(text: str) -> str:
    if len(text) <= MAX_EXCERPT_LINE_CHARS:
        return text
    return text[:MAX_EXCERPT_LINE_CHARS - 3] + "..."


def read_line_window(path: Path, center_line: int, context_lines: int) -> str | None:
    start_line = max(1, center_line - max(context_lines, 0))
    end_line = center_line + max(context_lines, 0)
    rows: list[str] = []
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for number, raw in enumerate(handle, 1):
                if number < start_line:
                    continue
                if number > end_line:
                    break
                rows.append(f"{number}: {truncate_excerpt_line(raw.rstrip())}")
    except Exception:
        return None
    return "\n".join(rows) if rows else None


def source_excerpt(root: Path, ref: dict[str, Any], context_lines: int,
                   cache: dict[tuple[str, int, int], str | None]) -> str | None:
    rel = ref.get("path")
    line = source_ref_line(ref)
    if not isinstance(rel, str) or not rel or not line:
        return None
    if is_generated_artifact(rel):
        return None
    cache_key = (rel, line, context_lines)
    if cache_key in cache:
        return cache[cache_key]
    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    cache[cache_key] = read_line_window(path, line, context_lines)
    return cache[cache_key]


def source_fingerprint(root: Path, rel: str, span: dict[str, Any] | None) -> dict[str, str] | None:
    if not isinstance(rel, str) or not rel or rel == POST_EVENT_REL or is_generated_artifact(rel):
        return None
    start = span.get("startLine") if isinstance(span, dict) else None
    end = span.get("endLine") if isinstance(span, dict) else None
    if not isinstance(start, int) or not isinstance(end, int) or start < 1 or end < start:
        return None
    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    rows: list[str] = []
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for number, raw in enumerate(handle, 1):
                if number < start:
                    continue
                if number > end:
                    break
                rows.append(raw.rstrip("\n"))
    except Exception:
        return None
    if not rows:
        return None
    payload = "\n".join(rows).encode("utf-8", errors="replace")
    return {
        "algorithm": "sha256",
        "scope": "topLevelSpan",
        "value": hashlib.sha256(payload).hexdigest(),
    }


def add_source_excerpts(index: dict[str, Any], root: Path, context_lines: int) -> None:
    cache: dict[tuple[str, int, int], str | None] = {}

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if "excerpt" not in value and "path" in value and source_ref_line(value):
                excerpt = source_excerpt(root, value, context_lines, cache)
                if excerpt:
                    value["excerpt"] = excerpt
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(index)


def property_source(item: dict[str, Any], path: str, prop: str) -> dict[str, Any]:
    meta = item.get("metadata", {})
    prop_meta = meta.get(prop)
    if isinstance(prop_meta, dict):
        prop_path = prop_meta.get("path") or prop_meta.get("$file") or path
        return source_ref(prop_path, prop_meta.get("line"))
    return source_ref(path, line_from_span(item.get("sourceSpan")))


def boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return bool(value)


def split_tags(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        parts = raw
    else:
        parts = re.split(r"[\s,]+", str(raw).strip())
    return sorted({part for part in parts if part})


def parse_info(root: Path) -> dict[str, str]:
    info_path = root / "source" / "info.dry"
    if not info_path.exists():
        raise FileNotFoundError(f"Missing required project file: {info_path}")

    info: dict[str, str] = {}
    for raw in info_path.read_text(encoding="utf-8").splitlines():
        if ":" not in raw:
            continue
        key, value = raw.split(":", 1)
        info[key.strip()] = value.strip()
    return info


def parse_info_source(root: Path) -> dict[str, dict[str, Any]]:
    info_path = root / "source" / "info.dry"
    if not info_path.exists():
        raise FileNotFoundError(f"Missing required project file: {info_path}")

    source: dict[str, dict[str, Any]] = {}
    for line_number, raw in enumerate(info_path.read_text(encoding="utf-8").splitlines(), start=1):
        if ":" not in raw:
            continue
        key, _value = raw.split(":", 1)
        normalized_key = key.strip()
        if not normalized_key:
            continue
        source[normalized_key] = {
            "path": "source/info.dry",
            "line": line_number,
            "rawAnchorText": raw,
            "anchorText": raw,
        }
    return source


def iter_project_files(root: Path) -> list[Path]:
    skip_dirs = {".git", "node_modules", ".pytest_cache", "__pycache__"}
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name not in skip_dirs]
        base = Path(dirpath)
        for filename in filenames:
            path = base / filename
            if is_generated_artifact(posix_rel(path, root)):
                continue
            files.append(path)
    return sorted(files, key=lambda p: posix_rel(p, root))


def glob_exists(root: Path, pattern: str) -> bool:
    return any(not is_generated_artifact(posix_rel(path, root)) for path in root.glob(pattern))


def compile_regex(pattern: str) -> re.Pattern[str] | None:
    try:
        return re.compile(pattern)
    except re.error:
        return None


SCRIPT_WRITE_RE = re.compile(
    r"\bQ(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\s*['\"][^'\"]+['\"]\s*\])\s*(?:[+\-*/%]?=|\+\+|--)"
)

SCRIPT_STATEMENT_RE = re.compile(
    r"^(?:if\s*\(|else\b|for\s*\(|while\s*\(|switch\s*\(|case\s+|break\b|continue\b|return\b|"
    r"var\s+|let\s+|const\s+|function\b|console\.|\}\s*(?:else\b)?|\{|\);?|\};?)"
)


def compact_visible_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def is_hidden_script_or_comment_line(stripped: str) -> bool:
    if not stripped:
        return False
    if stripped.startswith("//"):
        return True
    if SCRIPT_WRITE_RE.search(stripped):
        return True
    if SCRIPT_STATEMENT_RE.match(stripped):
        return True
    if stripped.endswith(";") and ("Q." in stripped or "Q[" in stripped):
        return True
    return False
