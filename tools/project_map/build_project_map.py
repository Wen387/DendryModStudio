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

SCRIPT_DIR = Path(__file__).resolve().parent
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
    "unavailable-subtitle": "unavailable_text",
}
DENDRY_BUILTIN_SCENES = {
    "jumpScene",
    "prevScene",
    "prevTopScene",
    "backSpecialScene",
    "returnScene",
}

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


def score_profiles(root: Path, parser_index: dict[str, Any]) -> list[dict[str, Any]]:
    profiles = load_profiles()
    files = iter_project_files(root)
    rel_files = [posix_rel(path, root) for path in files]

    content_candidates = []
    for path in files:
        rel = posix_rel(path, root)
        if rel == POST_EVENT_REL:
            continue
        if is_generated_artifact(rel):
            continue
        if path.suffix.lower() not in {".dry", ".md", ".json", ".js"}:
            continue
        if path.stat().st_size > 512 * 1024:
            continue
        content_candidates.append(path)

    scored = []
    for profile in profiles:
        score = 0.0
        evidence: list[str] = []
        detection = profile.get("detection", {})

        for hint in detection.get("pathHints", []):
            pattern = hint.get("pattern", "")
            if pattern and glob_exists(root, pattern):
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"path:{pattern}")

        for hint in detection.get("fileNameHints", []):
            pattern = hint.get("pattern", "")
            if not pattern:
                continue
            if any(fnmatch.fnmatch(Path(rel).name, pattern) or fnmatch.fnmatch(rel, pattern)
                   for rel in rel_files):
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"file:{pattern}")

        for hint in detection.get("contentHints", []):
            pattern = hint.get("regex", "")
            if not pattern:
                continue
            regex = re.compile(pattern, re.MULTILINE)
            matched = False
            for candidate in content_candidates:
                try:
                    if regex.search(read_text_prefix(candidate)):
                        matched = True
                        break
                except Exception:
                    continue
            if matched:
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"content:{pattern}")

        # A parser-backed scene set is enough to include generic-dendry.
        if profile.get("id") == "generic-dendry" and parser_index.get("sceneCount", 0) > 0:
            score = max(score, 0.75)
            evidence.append("parser:sceneCount>0")

        scored.append({
            "id": profile.get("id"),
            "name": profile.get("name", profile.get("id")),
            "version": profile.get("profileVersion", "0.1"),
            "priority": profile.get("priority", 0),
            "confidence": round(min(score, 1.0), 3),
            "confidenceLabel": CONF_PROFILE,
            "evidence": evidence[:10],
            "_profile": profile,
        })

    selected_ids = {item["id"] for item in scored if item["confidence"] >= 0.25}
    if parser_index.get("sceneCount", 0) > 0:
        selected_ids.add("generic-dendry")

    by_id = {profile.get("id"): profile for profile in profiles}

    def include_parents(profile_id: str) -> None:
        profile = by_id.get(profile_id)
        parent = profile.get("extends") if profile else None
        if parent and parent not in selected_ids:
            selected_ids.add(parent)
            include_parents(parent)

    for profile_id in list(selected_ids):
        include_parents(profile_id)

    return sorted(
        [item for item in scored if item["id"] in selected_ids],
        key=lambda item: (item.get("priority", 0), item["id"]),
    )


def run_node_parser(root: Path) -> dict[str, Any]:
    result = subprocess.run(
        ["node", str(PARSER_WRAPPER), "--root", str(root)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if not result.stdout.strip():
        detail = (result.stderr or "").strip()
        raise RuntimeError(f"Node parser produced no JSON. {detail}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not decode Node parser output: {exc}") from exc
    if result.returncode not in {0, 1}:
        detail = (result.stderr or "").strip()
        raise RuntimeError(f"Node parser failed with exit {result.returncode}: {detail}")
    data["_stderr"] = result.stderr.strip()
    data["_returncode"] = result.returncode
    return data


def load_parser_index(path: Path) -> dict[str, Any]:
    try:
        parser_index = load_json(path)
    except Exception as exc:
        raise RuntimeError(f"Could not load parser index {path}: {exc}") from exc
    if not isinstance(parser_index, dict):
        raise RuntimeError(f"Parser index {path} must be a JSON object.")
    parser_index.setdefault("_stderr", "")
    parser_index.setdefault("_returncode", 0)
    return parser_index


class VariableScanner:
    ARRAY_LITERAL_RE = re.compile(
        r"""(?:var|let|const)?\s*(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[\s*((?:'[^']*'|"[^"]*"|\s|,)+)\]""",
        re.VERBOSE,
    )
    DOT_ACCESS_RE = re.compile(r"Q\.([A-Za-z_][A-Za-z0-9_]*)")
    DOT_WRITE_RE = re.compile(
        r"Q\.([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|/=|(?<![=!<>])=(?!=))"
    )
    DYN_ACCESS_RE = re.compile(r"Q\[([^\]]+)\]")
    DYN_WRITE_RE = re.compile(r"Q\[([^\]]+)\]\s*(\+=|-=|\*=|/=|(?<![=!<>])=(?!=))")
    SHORTHAND_WRITE_RE = re.compile(
        r"(?:^|;)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|/=|(?<![=!<>])=(?!=))"
    )

    def __init__(self, root: Path):
        self.root = root
        self.variables: dict[str, dict[str, Any]] = {}
        self.known_arrays: dict[str, list[str]] = {}
        self.diagnostics: list[dict[str, Any]] = []
        self.opaque_js_blocks: Counter[str] = Counter()
        self._reported_dynamic: set[tuple[str, int, str]] = set()

    def scan(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        source = self.root / "source"
        files = sorted(source.rglob("*.dry"), key=lambda p: posix_rel(p, self.root))
        self.collect_known_arrays(files)
        for path in files:
            rel = posix_rel(path, self.root)
            if rel == POST_EVENT_REL:
                self.diagnostics.append({
                    "severity": "info",
                    "code": "project_map.post_event_opaque",
                    "message": (
                        "post_event.scene.dry is intentionally opaque; only bounded "
                        "targeted routing/news summary is indexed."
                    ),
                    "path": rel,
                    "source": source_ref(rel),
                    "confidence": CONF_OPAQUE,
                })
                continue
            try:
                lines = path.read_text(encoding="utf-8").splitlines()
            except Exception as exc:
                self.diagnostics.append({
                    "severity": "warning",
                    "code": "project_map.read_failed",
                    "message": f"Could not read {rel}: {exc}",
                    "path": rel,
                    "source": source_ref(rel),
                    "confidence": CONF_OPAQUE,
                })
                continue
            self.scan_lines(rel, lines)

        variables = []
        for name in sorted(self.variables):
            record = self.variables[name]
            record["readCount"] = len(record.get("reads", []))
            record["writeCount"] = len(record.get("writes", []))
            variables.append(record)
        summary = {
            "opaqueJsBlockCount": sum(self.opaque_js_blocks.values()),
            "opaqueJsBlocksByPath": dict(sorted(self.opaque_js_blocks.items())),
        }
        return variables, self.diagnostics, summary

    def ensure_var(self, name: str) -> dict[str, Any]:
        record = self.variables.get(name)
        if not record:
            record = {
                "name": name,
                "scope": "q",
                "reads": [],
                "writes": [],
                "definedIn": [],
                "confidence": CONF_STATIC,
            }
            self.variables[name] = record
        return record

    def record_read(self, name: str, rel: str, line: int, confidence: str = CONF_STATIC) -> None:
        if not name:
            return
        self.ensure_var(name)["reads"].append(source_ref(rel, line))
        if confidence == CONF_OPAQUE:
            self.ensure_var(name)["confidence"] = CONF_OPAQUE

    def record_write(self, name: str, rel: str, line: int, confidence: str = CONF_STATIC) -> None:
        if not name:
            return
        record = self.ensure_var(name)
        ref = source_ref(rel, line)
        record["writes"].append(ref)
        if rel == "source/scenes/root.scene.dry":
            record["definedIn"].append(ref)
        if confidence == CONF_OPAQUE:
            record["confidence"] = CONF_OPAQUE

    @staticmethod
    def strip_line_comment(line: str) -> str:
        return re.sub(r"//.*$", "", line)

    @staticmethod
    def is_plain_assignment_suffix(suffix: str) -> bool:
        suffix = suffix.lstrip()
        return (
            suffix.startswith("=")
            and not suffix.startswith("==")
            and not suffix.startswith("===")
            and not suffix.startswith("=>")
        )

    @staticmethod
    def parse_string_array(body: str) -> list[str] | None:
        values = []
        for match in re.finditer(r"'([^']*)'|\"([^\"]*)\"", body):
            values.append(match.group(1) if match.group(1) is not None else match.group(2))
        stripped = re.sub(r"'[^']*'|\"[^\"]*\"", "", body)
        if re.search(r"[^\s,]", stripped):
            return None
        return values or None

    def collect_known_arrays(self, files: list[Path]) -> None:
        for path in files:
            rel = posix_rel(path, self.root)
            if rel == POST_EVENT_REL:
                continue
            try:
                text = read_text_prefix(path)
            except Exception:
                continue
            for match in self.ARRAY_LITERAL_RE.finditer(text):
                values = self.parse_string_array(match.group(2))
                if values:
                    self.known_arrays.setdefault(match.group(1), values)

    def collect_block_array_bindings(self, lines: list[str]) -> dict[str, list[str]]:
        bindings = dict(self.known_arrays)
        for line in lines:
            for match in self.ARRAY_LITERAL_RE.finditer(line):
                values = self.parse_string_array(match.group(2))
                if values:
                    bindings[match.group(1)] = values
        return bindings

    @staticmethod
    def update_iter_bindings(line: str, bindings: dict[str, list[str]]) -> None:
        for_of = re.compile(r"for\s*\(\s*(?:var|let|const)?\s*(\w+)\s+of\s+(Q\.\w+|\w+)\s*\)")
        for match in for_of.finditer(line):
            iter_var = match.group(1)
            source = match.group(2)
            name = source[2:] if source.startswith("Q.") else source
            if name in bindings:
                bindings[iter_var] = bindings[name]

        range_re = re.compile(
            r"for\s*\(\s*(?:var|let|const)?\s*(\w+)\s*=\s*(-?\d+)\s*;"
            r"\s*\1\s*(<=|<)\s*(-?\d+)\s*;\s*\1\+\+\s*\)"
        )
        for match in range_re.finditer(line):
            iter_var = match.group(1)
            start = int(match.group(2))
            op = match.group(3)
            end = int(match.group(4))
            stop = end if op == "<=" else end - 1
            if start <= stop and stop - start <= 500:
                bindings[iter_var] = [str(num) for num in range(start, stop + 1)]

        indexed = re.compile(r"(?:var|let|const)\s+(\w+)\s*=\s*(Q\.\w+|\w+)\[")
        for match in indexed.finditer(line):
            iter_var = match.group(1)
            source = match.group(2)
            name = source[2:] if source.startswith("Q.") else source
            if name in bindings:
                bindings[iter_var] = bindings[name]

    @staticmethod
    def expand_dynamic_key(expr: str, bindings: dict[str, list[str]]) -> list[str] | None:
        parts = re.split(r"\s*\+\s*", expr.strip())
        resolved: list[list[str]] = []
        for part in parts:
            part = part.strip()
            literal = re.match(r"^'([^']*)'$|^\"([^\"]*)\"$", part)
            if literal:
                resolved.append([literal.group(1) if literal.group(1) is not None else literal.group(2)])
                continue
            indexed = re.match(r"^(?:Q\.)?(\w+)\[[^\]]+\]$", part)
            if indexed and indexed.group(1) in bindings:
                resolved.append(bindings[indexed.group(1)])
                continue
            if part in bindings:
                resolved.append(bindings[part])
                continue
            return None

        out = [""]
        for values in resolved:
            out = [prefix + value for prefix in out for value in values]
        out = [value for value in out if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", value)]
        return out or None

    def report_dynamic_uncertainty(self, rel: str, line: int, expr: str) -> None:
        key = (rel, line, expr)
        if key in self._reported_dynamic:
            return
        self._reported_dynamic.add(key)
        self.diagnostics.append({
            "severity": "info",
            "code": "project_map.dynamic_q_opaque",
            "message": f"Dynamic Q[] key could not be statically expanded: Q[{expr}]",
            "path": rel,
            "source": source_ref(rel, line),
            "confidence": CONF_OPAQUE,
        })

    def iter_js_blocks(self, rel: str, lines: list[str]) -> list[list[tuple[int, str]]]:
        blocks: list[list[tuple[int, str]]] = []
        in_block = False
        current: list[tuple[int, str]] = []
        for line_num, line in enumerate(lines, 1):
            if not in_block:
                if re.search(r"\b(on-arrival|on-display)\s*:\s*\{!", line):
                    in_block = True
                    current = [(line_num, line)]
                    self.opaque_js_blocks[rel] += 1
                    if "!}" in line:
                        blocks.append(current)
                        current = []
                        in_block = False
                continue
            current.append((line_num, line))
            if "!}" in line:
                blocks.append(current)
                current = []
                in_block = False
        if current:
            blocks.append(current)
        return blocks

    def scan_lines(self, rel: str, lines: list[str]) -> None:
        for line_num, line in enumerate(lines, 1):
            if "view-if:" in line:
                self.extract_vars_from_condition(line.split("view-if:", 1)[1], rel, line_num)
            if "choose-if:" in line:
                self.extract_vars_from_condition(line.split("choose-if:", 1)[1], rel, line_num)
            for match in re.finditer(r"\[\?\s*if\s+([^:?]+)", line):
                self.extract_vars_from_condition(match.group(1), rel, line_num)
            if "go-to:" in line and " if " in line:
                for condition in re.findall(r"\s+if\s+([^;]+)", line):
                    self.extract_vars_from_condition(condition, rel, line_num)
            for match in re.finditer(r"\[\+\s*([A-Za-z_][A-Za-z0-9_]*)\b", line):
                self.record_read(match.group(1), rel, line_num)
            if "on-arrival:" in line and "{!" not in line:
                self.scan_shorthand_on_arrival(rel, line_num, line.split("on-arrival:", 1)[1])

        for block in self.iter_js_blocks(rel, lines):
            self.scan_js_block(rel, block)

    def extract_vars_from_condition(self, condition: str, rel: str, line_num: int) -> None:
        stripped = re.sub(r"'[^']*'", "", condition)
        stripped = re.sub(r'"[^"]*"', "", stripped)
        for match in self.DOT_ACCESS_RE.finditer(stripped):
            self.record_read(match.group(1), rel, line_num)
        for match in re.finditer(r"\b([a-z_][A-Za-z0-9_]*)\b", stripped):
            name = match.group(1)
            if name not in RESERVED_CONDITION_WORDS:
                self.record_read(name, rel, line_num)

    def scan_shorthand_on_arrival(self, rel: str, line_num: int, raw: str) -> None:
        for match in self.SHORTHAND_WRITE_RE.finditer(raw):
            name, op = match.group(1), match.group(2)
            self.record_write(name, rel, line_num)
            if op != "=":
                self.record_read(name, rel, line_num)
        self.scan_js_text(rel, [(line_num, raw)])

    def scan_js_block(self, rel: str, block: list[tuple[int, str]]) -> None:
        self.scan_js_text(rel, block)

    def scan_js_text(self, rel: str, block: list[tuple[int, str]]) -> None:
        block_lines = [content for _, content in block]
        bindings = self.collect_block_array_bindings(block_lines)
        for line_num, raw in block:
            line = self.strip_line_comment(raw)
            self.update_iter_bindings(line, bindings)

            plain_write_starts = set()
            for match in self.DOT_WRITE_RE.finditer(line):
                name, op = match.group(1), match.group(2)
                self.record_write(name, rel, line_num)
                if op == "=":
                    plain_write_starts.add(match.start())
                else:
                    self.record_read(name, rel, line_num)

            for match in self.DOT_ACCESS_RE.finditer(line):
                if match.start() in plain_write_starts:
                    continue
                if self.is_plain_assignment_suffix(line[match.end():]):
                    continue
                self.record_read(match.group(1), rel, line_num)

            dynamic_write_spans: list[tuple[int, int]] = []
            for match in self.DYN_WRITE_RE.finditer(line):
                expr, op = match.group(1), match.group(2)
                dynamic_write_spans.append((match.start(), match.end()))
                names = self.expand_dynamic_key(expr, bindings)
                if not names:
                    self.report_dynamic_uncertainty(rel, line_num, expr)
                    continue
                for name in names:
                    self.record_write(name, rel, line_num)
                    if op != "=":
                        self.record_read(name, rel, line_num)

            for match in self.DYN_ACCESS_RE.finditer(line):
                if any(start <= match.start() < end for start, end in dynamic_write_spans):
                    continue
                if self.is_plain_assignment_suffix(line[match.end():]):
                    continue
                expr = match.group(1)
                names = self.expand_dynamic_key(expr, bindings)
                if not names:
                    self.report_dynamic_uncertainty(rel, line_num, expr)
                    continue
                for name in names:
                    self.record_read(name, rel, line_num)


def compile_regex(pattern: str) -> re.Pattern[str] | None:
    try:
        return re.compile(pattern)
    except re.error:
        return None


def profile_rule_match(rule: dict[str, Any], scene: dict[str, Any]) -> bool:
    path = scene.get("path", "")
    name = scene.get("id", "")
    path_regex = rule.get("pathRegex")
    name_regex = rule.get("nameRegex")
    if path_regex:
        regex = compile_regex(path_regex)
        if not regex or not regex.search(path):
            return False
    if name_regex:
        regex = compile_regex(name_regex)
        if not regex or not regex.search(name):
            return False
    return bool(path_regex or name_regex)


def scene_has_timeline_event_evidence(scene: dict[str, Any]) -> bool:
    path = scene.get("path", "")
    tags = set(split_tags(scene.get("tags")))
    return "event" in tags or "/events/" in path or "/event/" in path


def classify_scene(scene: dict[str, Any], selected_profiles: list[dict[str, Any]]) -> tuple[str, str, str | None]:
    if boolish(scene.get("isDeck")):
        return "deck", CONF_EXACT, None
    if boolish(scene.get("isHand")):
        return "hand", CONF_EXACT, None
    if scene_has_timeline_event_evidence(scene):
        for profile_ref in sorted(selected_profiles, key=lambda p: p.get("priority", 0), reverse=True):
            profile = profile_ref.get("_profile", {})
            for rule in profile.get("classificationRules", {}).get("sceneTypes", []):
                if rule.get("type") in {"event", "election"} and profile_rule_match(rule, scene):
                    return rule.get("type", "event"), CONF_PROFILE, profile_ref.get("id")
        return "event", CONF_EXACT, None
    if boolish(scene.get("isCard")):
        return "card", CONF_EXACT, None
    if boolish(scene.get("isPinnedCard")):
        return "pinned_card", CONF_EXACT, None

    for profile_ref in sorted(selected_profiles, key=lambda p: p.get("priority", 0), reverse=True):
        profile = profile_ref.get("_profile", {})
        for rule in profile.get("classificationRules", {}).get("sceneTypes", []):
            if profile_rule_match(rule, scene):
                return rule.get("type", "scene"), CONF_PROFILE, profile_ref.get("id")
    return "scene", CONF_PROFILE, None


def normalize_parser_scene(scene: dict[str, Any], root: Path,
                           selected_profiles: list[dict[str, Any]]) -> dict[str, Any]:
    path = scene.get("path", "")
    scene_type, classification_confidence, profile_id = classify_scene(scene, selected_profiles)
    out: dict[str, Any] = {
        "id": scene.get("id"),
        "name": scene.get("id"),
        "title": scene.get("title", ""),
        "path": path,
        "type": scene_type,
        "profileId": profile_id,
        "confidence": CONF_EXACT,
        "classificationConfidence": classification_confidence,
        "sourceSpan": span_ref(path, scene.get("sourceSpan")),
        "topLevelSpan": span_ref(path, scene.get("topLevelSpan")),
        "metadata": normalize_metadata_paths(scene.get("metadata", {}), root),
        "tags": split_tags(scene.get("tags")),
        "flags": {
            "isCard": boolish(scene.get("isCard")),
            "isPinnedCard": boolish(scene.get("isPinnedCard")),
            "isHand": boolish(scene.get("isHand")),
            "isDeck": boolish(scene.get("isDeck")),
            "isSpecial": boolish(scene.get("isSpecial")),
        },
        "routes": scene.get("routes", {}),
        "options": [],
        "sections": [],
    }
    fingerprint = source_fingerprint(root, path, out.get("topLevelSpan"))
    if fingerprint:
        out["sourceFingerprint"] = fingerprint
    for field in [
        "viewIf",
        "chooseIf",
        "priority",
        "frequency",
        "frequencyVar",
        "maxVisits",
        "maxVisitsVar",
        "newPage",
        "setRoot",
        "gameOver",
    ]:
        if field in scene:
            out[field] = scene[field]

    for option in scene.get("options", []):
        item = dict(option)
        item["metadata"] = normalize_metadata_paths(item.get("metadata", {}), root)
        item["sourceSpan"] = span_ref(path, item.get("sourceSpan"))
        out["options"].append(item)

    for section in scene.get("sections", []):
        item = dict(section)
        item["metadata"] = normalize_metadata_paths(item.get("metadata", {}), root)
        item["sourceSpan"] = span_ref(path, item.get("sourceSpan"))
        item["tags"] = split_tags(item.get("tags"))
        item["options"] = []
        for option in section.get("options", []):
            opt_item = dict(option)
            opt_item["metadata"] = normalize_metadata_paths(opt_item.get("metadata", {}), root)
            opt_item["sourceSpan"] = span_ref(path, opt_item.get("sourceSpan"))
            item["options"].append(opt_item)
        out["sections"].append(item)
    asset_refs = extract_scene_asset_references(root, out)
    if asset_refs:
        out["assetRefs"] = asset_refs
    return out


def route_field_to_kind(field: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r"_\1", field).lower()


class GraphBuilder:
    def __init__(self, scenes: list[dict[str, Any]]):
        self.scenes = scenes
        self.scene_ids = {scene["id"] for scene in scenes}
        self.anchors: dict[str, set[str]] = defaultdict(set)
        self.section_ids: set[str] = set()
        self.tags: set[str] = set()
        self.diagnostics: list[dict[str, Any]] = []

        for scene in scenes:
            scene_id = scene["id"]
            self.tags.update(scene.get("tags", []))
            for section in scene.get("sections", []):
                section_id = section.get("id", "")
                if section_id:
                    self.section_ids.add(section_id)
                    if section_id.startswith(scene_id + "."):
                        self.anchors[scene_id].add(section_id.split(".", 1)[1])
                self.tags.update(section.get("tags", []))

    def resolve_target(self, raw: str, current_scene: str, prefer_local_anchor: bool) -> tuple[str, bool]:
        target = raw.strip()
        if not target:
            return target, False
        if target in DENDRY_BUILTIN_SCENES:
            return f"runtime:{target}", True
        if target.startswith("."):
            resolved = f"{current_scene}.{target[1:]}"
            return resolved, resolved in self.section_ids
        if prefer_local_anchor and target in self.anchors.get(current_scene, set()):
            return f"{current_scene}.{target}", True
        if "." in target:
            if target in self.section_ids:
                return target, True
            scene_id, anchor = target.rsplit(".", 1)
            if scene_id in self.scene_ids and anchor in self.anchors.get(scene_id, set()):
                return target, True
            return target, scene_id in self.scene_ids
        if target in self.scene_ids:
            return target, True
        if target in self.anchors.get(current_scene, set()):
            return f"{current_scene}.{target}", True
        return target, False

    def build(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        edges: list[dict[str, Any]] = []
        for scene in self.scenes:
            self.add_routes(edges, scene, scene, scene["id"])
            self.add_options(edges, scene, scene, scene["id"])
            for section in scene.get("sections", []):
                self.add_routes(edges, scene, section, section["id"])
                self.add_options(edges, scene, section, section["id"])
        return edges, self.diagnostics

    def add_routes(self, edges: list[dict[str, Any]], scene: dict[str, Any],
                   item: dict[str, Any], from_id: str) -> None:
        path = scene["path"]
        for field, routes in item.get("routes", {}).items():
            route_kind = route_field_to_kind(field)
            route_source = property_source(item, path, field)
            if len(routes) > 1 or any(route.get("predicate") for route in routes):
                raw_summary = "; ".join(str(route.get("raw", route.get("id", ""))) for route in routes)
                self.add_conditional_diagnostic(scene, item, route_source, field, raw_summary)
            for route in routes:
                raw_target = str(route.get("id", "")).strip()
                if not raw_target:
                    continue
                resolved, ok = self.resolve_target(raw_target, scene["id"], prefer_local_anchor=False)
                edge: dict[str, Any] = {
                    "from": from_id,
                    "to": resolved,
                    "kind": route_kind,
                    "rawTarget": raw_target,
                    "confidence": CONF_EXACT,
                    "source": route_source,
                }
                if route.get("predicate"):
                    edge["condition"] = route["predicate"]
                    edge["kind"] = "conditional_" + route_kind
                edges.append(edge)
                if not ok:
                    self.add_missing_target(scene, item, route_source, raw_target, resolved, route_kind)

    def add_options(self, edges: list[dict[str, Any]], scene: dict[str, Any],
                    item: dict[str, Any], from_id: str) -> None:
        path = scene["path"]
        for option in item.get("options", []):
            option_id = str(option.get("id", "")).strip()
            if not option_id:
                continue
            line = line_from_span(option.get("sourceSpan"))
            src = source_ref(path, line)
            if option_id.startswith("#"):
                tag = option_id[1:]
                target = f"tag:{tag}"
                edges.append({
                    "from": from_id,
                    "to": target,
                    "kind": "tag_choice",
                    "rawTarget": option_id,
                    "confidence": CONF_EXACT,
                    "source": src,
                })
                if tag not in self.tags:
                    self.add_missing_target(scene, item, src, option_id, target, "tag_choice")
                continue
            raw_target = option_id[1:] if option_id.startswith("@") else option_id
            resolved, ok = self.resolve_target(raw_target, scene["id"], prefer_local_anchor=True)
            edges.append({
                "from": from_id,
                "to": resolved,
                "kind": "choice",
                "rawTarget": option_id,
                "label": option.get("title", ""),
                "confidence": CONF_EXACT,
                "source": src,
            })
            if not ok:
                self.add_missing_target(scene, item, src, option_id, resolved, "choice")

    def add_missing_target(self, scene: dict[str, Any], item: dict[str, Any],
                           src: dict[str, Any], raw: str, resolved: str, kind: str) -> None:
        self.diagnostics.append({
            "severity": "warning",
            "code": "project_map.missing_target",
            "message": f"{kind} target '{raw}' could not be resolved",
            "path": scene["path"],
            "sceneId": scene["id"],
            "source": src,
            "target": resolved,
            "confidence": CONF_EXACT,
        })

    def add_conditional_diagnostic(self, scene: dict[str, Any], item: dict[str, Any],
                                   src: dict[str, Any], field: str, raw: str) -> None:
        self.diagnostics.append({
            "severity": "info",
            "code": "project_map.conditional_goto",
            "message": f"Conditional or chained {field} requires runtime ordering awareness: {raw}",
            "path": scene["path"],
            "sceneId": scene["id"],
            "source": src,
            "confidence": CONF_EXACT,
        })


def parse_route_clauses(value: str) -> list[dict[str, str]]:
    clauses = []
    for chunk in value.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = re.split(r"\s+if\s+", chunk, 1)
        route = {"id": parts[0].strip(), "raw": chunk}
        if len(parts) == 2:
            route["predicate"] = parts[1].strip()
        clauses.append(route)
    return clauses


def find_context_for_line(scene: dict[str, Any], line_num: int) -> str:
    for section in scene.get("sections", []):
        span = section.get("sourceSpan", {})
        start = span.get("startLine")
        end = span.get("endLine")
        if start and end and start <= line_num <= end:
            return section.get("id", scene["id"])
    return scene["id"]


def add_textual_goto_overlay(root: Path, scenes: list[dict[str, Any]],
                             edges: list[dict[str, Any]],
                             graph: GraphBuilder) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Add regex-only go-to lines missing from parser metadata.

    These edges are useful authoring breadcrumbs, but not parser-backed.
    """
    parser_goto_lines = {
        (edge.get("source", {}).get("path"), edge.get("source", {}).get("line"))
        for edge in edges
        if edge.get("kind") in {"go_to", "conditional_go_to"} and edge.get("confidence") == CONF_EXACT
    }
    scenes_by_path = {scene["path"]: scene for scene in scenes}
    overlay_edges: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []

    for rel, scene in sorted(scenes_by_path.items()):
        if rel == POST_EVENT_REL:
            continue
        path = root / rel
        if not path.exists():
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for line_num, line in enumerate(lines, 1):
            match = re.match(r"^\s*go-to:\s*(.+)$", line)
            if not match:
                continue
            if (rel, line_num) in parser_goto_lines:
                continue
            src = source_ref(rel, line_num)
            context_id = find_context_for_line(scene, line_num)
            routes = parse_route_clauses(match.group(1))
            diagnostics.append({
                "severity": "warning",
                "code": "project_map.regex_only_goto",
                "message": "go-to line was found by static text scan but not exposed by the Dendry parser.",
                "path": rel,
                "sceneId": scene["id"],
                "source": src,
                "confidence": CONF_STATIC,
            })
            for route in routes:
                raw_target = route.get("id", "").strip()
                if not raw_target:
                    continue
                resolved, ok = graph.resolve_target(raw_target, scene["id"], prefer_local_anchor=False)
                edge: dict[str, Any] = {
                    "from": context_id,
                    "to": resolved,
                    "kind": "conditional_go_to" if route.get("predicate") else "go_to",
                    "rawTarget": raw_target,
                    "confidence": CONF_STATIC,
                    "parserBacked": False,
                    "source": src,
                }
                if route.get("predicate"):
                    edge["condition"] = route["predicate"]
                overlay_edges.append(edge)
                if not ok:
                    diagnostics.append({
                        "severity": "warning",
                        "code": "project_map.missing_target",
                        "message": f"static go-to target '{raw_target}' could not be resolved",
                        "path": rel,
                        "sceneId": scene["id"],
                        "source": src,
                        "target": resolved,
                        "confidence": CONF_STATIC,
                    })

    return overlay_edges, diagnostics


def classify_semantics(root: Path, scenes: list[dict[str, Any]],
                       variables: list[dict[str, Any]],
                       selected_profiles: list[dict[str, Any]],
                       post_event_summary: dict[str, Any] | None = None) -> dict[str, Any]:
    events = []
    cards = []
    hands = []
    decks = []
    pinned_cards = []
    systems: dict[str, set[str]] = defaultdict(set)
    labels = []

    profile_system_rules = []
    variable_family_rules = []
    for profile_ref in selected_profiles:
        profile = profile_ref.get("_profile", {})
        rules = profile.get("classificationRules", {})
        for rule in rules.get("semanticSystems", []):
            profile_system_rules.append((profile_ref["id"], rule))
        for rule in rules.get("variableFamilies", []):
            variable_family_rules.append((profile_ref["id"], rule))

    for scene in scenes:
        scene_id = scene["id"]
        path = scene["path"]
        flags = scene.get("flags", {})
        tags = set(scene.get("tags", []))
        timeline_event = scene_has_timeline_event_evidence(scene) or scene.get("type") in {"event", "election"}
        scene_ref = {
            "id": scene_id,
            "path": path,
            "title": scene.get("title", ""),
            "type": scene.get("type", "scene"),
            "confidence": scene.get("classificationConfidence", CONF_PROFILE),
        }
        if timeline_event:
            events.append(scene_ref)
            systems["events"].add(scene_id)
        if (flags.get("isCard") or scene.get("type") in {"card", "pinned_card"}) and not timeline_event:
            cards.append(scene_ref)
            systems["cards"].add(scene_id)
        if (flags.get("isPinnedCard") or scene.get("type") == "pinned_card") and not timeline_event:
            pinned_cards.append(scene_ref)
            systems["pinned_cards"].add(scene_id)
        if flags.get("isHand") or scene.get("type") == "hand":
            hands.append(scene_ref)
            systems["hands"].add(scene_id)
        if flags.get("isDeck") or scene.get("type") == "deck":
            decks.append(scene_ref)
            systems["decks"].add(scene_id)
        if path.endswith("post_event.scene.dry") or path.endswith("post_event_news.scene.dry"):
            systems["monthly_tick"].add(scene_id)

        for profile_id, rule in profile_system_rules:
            path_regex = compile_regex(rule.get("pathRegex", ""))
            name_regex = compile_regex(rule.get("nameRegex", ""))
            matched = False
            if path_regex and path_regex.search(path):
                matched = True
            if name_regex and name_regex.search(scene_id):
                matched = True
            if matched:
                system_id = rule.get("system")
                if system_id:
                    systems[system_id].add(scene_id)
                    labels.append({
                        "target": scene_id,
                        "label": system_id,
                        "profileId": profile_id,
                        "confidence": 0.7,
                        "confidenceLabel": CONF_PROFILE,
                        "evidence": [path],
                    })

    variable_labels = []
    for variable in variables:
        name = variable["name"]
        families = []
        for profile_id, rule in variable_family_rules:
            regex = compile_regex(rule.get("nameRegex", ""))
            if regex and regex.search(name):
                families.append(rule.get("family"))
                variable_labels.append({
                    "target": f"variable:{name}",
                    "label": rule.get("family"),
                    "profileId": profile_id,
                    "confidence": 0.65,
                    "confidenceLabel": CONF_PROFILE,
                    "evidence": [name],
                })
        if families:
            variable["tags"] = sorted(set(variable.get("tags", []) + [f for f in families if f]))

    labels.extend(variable_labels)

    news = extract_news(root)
    news["eventPopups"] = extract_legacy_event_popups(root, scenes, post_event_summary)
    surface_text = extract_surface_text(root, variables)
    text_corpus = extract_text_corpus(root, scenes, news, surface_text)

    return {
        "events": sorted(events, key=lambda item: item["id"]),
        "cards": sorted(cards, key=lambda item: item["id"]),
        "hands": sorted(hands, key=lambda item: item["id"]),
        "decks": sorted(decks, key=lambda item: item["id"]),
        "pinnedCards": sorted(pinned_cards, key=lambda item: item["id"]),
        "news": news,
        "surfaceText": surface_text,
        "textCorpus": text_corpus,
        "assets": extract_assets(root, scenes),
        "systems": [
            {"id": system_id, "label": system_id.replace("_", " ").title(), "members": sorted(members)}
            for system_id, members in sorted(systems.items())
        ],
        "groups": [
            {"id": "events", "label": "Events", "members": sorted(item["id"] for item in events)},
            {"id": "cards", "label": "Cards", "members": sorted(item["id"] for item in cards)},
            {"id": "hands", "label": "Hands", "members": sorted(item["id"] for item in hands)},
            {"id": "decks", "label": "Decks", "members": sorted(item["id"] for item in decks)},
            {"id": "pinned_cards", "label": "Pinned Cards", "members": sorted(item["id"] for item in pinned_cards)},
        ],
        "labels": labels,
    }


def news_candidate_files(root: Path) -> list[tuple[str, Path]]:
    """Return likely news-bearing scene files without depending on an Island-specific split."""
    base = root / "source" / "scenes"
    if not base.exists():
        return []
    candidates: list[tuple[str, Path]] = []
    seen: set[str] = set()

    def add(path: Path) -> None:
        try:
            rel = path.relative_to(root).as_posix()
        except ValueError:
            return
        if rel in seen or not path.exists():
            return
        seen.add(rel)
        candidates.append((rel, path))

    # Prefer known routers first, but do not require the newer post_event_news split.
    add(root / "source/scenes/post_event_news.scene.dry")
    add(root / "source/scenes/post_event.scene.dry")
    for path in sorted(base.rglob("*.scene.dry")):
        add(path)
    return candidates


def extract_news(root: Path) -> dict[str, Any]:
    candidates = news_candidate_files(root)
    if not candidates:
        return {"sources": [], "items": [], "confidence": CONF_OPAQUE}

    items: list[dict[str, Any]] = []
    matched_sources: set[str] = set()
    push_pattern = re.compile(
        r"\b([A-Za-z_$][\w$]*)\.push\(\s*\{\s*n\s*:\s*(['\"])(.*?)\2"
        r"(?:\s*,\s*d\s*:\s*(['\"])(.*?)\4)?"
    )
    direct_pattern = re.compile(
        r"^\s*Q(?:\.news_([123])|\[['\"]news_([123])['\"]\])\s*=\s*(['\"])(.*?)\3\s*;?\s*(?://.*)?$"
    )
    direct_desc_pattern = re.compile(
        r"^\s*Q(?:\.news_([123])_desc|\[['\"]news_([123])_desc['\"]\])\s*=\s*(['\"])(.*?)\3\s*;?\s*(?://.*)?$"
    )
    pending_direct: dict[tuple[str, str], dict[str, Any]] = {}

    for rel, path in candidates:
        try:
            handle = path.open("r", encoding="utf-8")
        except Exception:
            continue
        with handle:
            for line_num, line in enumerate(handle, 1):
                match = push_pattern.search(line)
                if match and "+" not in line:
                    headline = match.group(3).strip()
                    if headline:
                        pool = match.group(1)
                        items.append({
                            "headline": headline,
                            "description": match.group(5) or "",
                            "delivery": "background_pool",
                            "pool": pool,
                            "source": source_ref(rel, line_num),
                            "confidence": CONF_STATIC,
                        })
                        matched_sources.add(rel)
                    continue
                match = direct_pattern.match(line)
                if match:
                    if "+" in line or line.count("Q.news_") + line.count("Q['news_") + line.count('Q["news_') > 1:
                        continue
                    slot = match.group(1) or match.group(2)
                    headline = match.group(4).strip()
                    if not headline:
                        continue
                    item = {
                        "headline": headline,
                        "description": "",
                        "delivery": "dated",
                        "slot": f"news_{slot}",
                        "source": source_ref(rel, line_num),
                        "confidence": CONF_STATIC,
                    }
                    items.append(item)
                    pending_direct[(rel, slot)] = item
                    matched_sources.add(rel)
                    continue
                match = direct_desc_pattern.match(line)
                if match:
                    if "+" in line or line.count("Q.news_") + line.count("Q['news_") + line.count('Q["news_') > 1:
                        continue
                    slot = match.group(1) or match.group(2)
                    pending = pending_direct.get((rel, slot))
                    if pending:
                        pending["description"] = match.group(4)

    return {
        "sources": sorted(matched_sources),
        "items": items,
        "confidence": CONF_STATIC if items else CONF_OPAQUE,
    }


def first_player_visible_paragraph(root: Path, scene: dict[str, Any]) -> dict[str, Any] | None:
    rel = scene.get("path")
    if not isinstance(rel, str) or not rel or is_generated_artifact(rel):
        return None
    path = root / rel
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return None

    in_metadata = True
    in_magic = False
    for line_num, raw in enumerate(lines, 1):
        stripped = raw.strip()
        if not stripped:
            if in_metadata:
                continue
            continue
        if in_magic:
            if "!}" in stripped:
                in_magic = False
            continue
        if "{!" in stripped:
            if "!}" not in stripped:
                in_magic = True
            continue
        if stripped.startswith("#"):
            continue
        if in_metadata and re.match(r"^[A-Za-z][A-Za-z0-9_-]*\s*:", stripped):
            continue
        in_metadata = False
        if stripped.startswith(("=", "@", "-", "{!", "!}")):
            continue
        if stripped.startswith("[?"):
            continue
        if is_hidden_script_or_comment_line(stripped):
            continue
        if len(stripped) < 24:
            continue
        return {
            "text": compact_visible_text(stripped),
            "source": source_range_ref(rel, line_num, line_num),
        }
    return None


def extract_legacy_event_popups(root: Path, scenes: list[dict[str, Any]],
                                post_event_summary: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not post_event_summary:
        return []
    tag_choices = [
        item for item in post_event_summary.get("tagChoices", [])
        if item.get("tag") == "event"
    ]
    if not tag_choices:
        return []
    router = tag_choices[0]
    out: list[dict[str, Any]] = []
    for scene in scenes:
        if "event" not in set(split_tags(scene.get("tags"))):
            continue
        if scene.get("path") == POST_EVENT_REL:
            continue
        source = property_source(scene, scene.get("path", ""), "tags")
        paragraph = first_player_visible_paragraph(root, scene)
        item: dict[str, Any] = {
            "delivery": "legacy_event_popup",
            "headline": scene.get("title") or scene.get("id") or "(untitled event popup)",
            "title": scene.get("title") or scene.get("id") or "(untitled event popup)",
            "description": paragraph.get("text", "") if paragraph else "",
            "excerpt": paragraph.get("text", "") if paragraph else "",
            "linkedSceneId": scene.get("id", ""),
            "viewIf": scene.get("viewIf", ""),
            "router": {
                "tag": router.get("tag", "event"),
                "anchor": router.get("anchor", ""),
                "path": POST_EVENT_REL,
                "line": router.get("line"),
            },
            "source": source,
            "confidence": CONF_STATIC,
        }
        if paragraph and paragraph.get("source"):
            item["excerptSource"] = paragraph["source"]
        out.append(item)
    return sorted(out, key=lambda item: (item.get("linkedSceneId", ""), item.get("headline", "")))


def asset_type_for_extension(extension: str) -> str | None:
    ext = extension.lower()
    if ext in IMAGE_ASSET_EXTENSIONS:
        return "image"
    if ext in AUDIO_ASSET_EXTENSIONS:
        return "audio"
    return None


def asset_source_kind(rel: str) -> tuple[str, str, str]:
    normalized = rel.replace("\\", "/")
    if normalized.startswith("out/html/"):
        return ("runtime_evidence", "ide_escape_hatch", CONF_PROFILE)
    return ("source_asset", "reference_only", CONF_STATIC)


def safe_asset_id(rel: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_]+", "_", rel).strip("_").lower()
    return base or "asset"


def normalize_asset_path(value: str) -> str:
    return re.sub(r"/+", "/", str(value or "").strip().replace("\\", "/").lstrip("./"))


def asset_paths_from_directive(value: str) -> list[str]:
    out: list[str] = []
    for match in re.finditer(
        r"([^\s'\"<>]+(?:\.(?:png|jpe?g|gif|webp|svg|mp3|ogg|wav|flac|m4a)))",
        value,
        re.IGNORECASE,
    ):
        normalized = normalize_asset_path(match.group(1).strip(".,;:"))
        if Path(normalized).suffix.lower() in MEDIA_ASSET_EXTENSIONS:
            out.append(normalized)
    return out


def resolve_asset_reference(root: Path, rel: str) -> tuple[bool, str]:
    normalized = normalize_asset_path(rel)
    candidates = [
        root / normalized,
        root / "out/html" / normalized,
        root / "source" / normalized,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return True, posix_rel(candidate, root)
    return False, ""


def asset_reference_usage(scene: dict[str, Any], line_num: int, directive: str) -> dict[str, Any]:
    return {
        "kind": scene.get("type", "scene"),
        "view": "scenes",
        "id": scene.get("id", ""),
        "label": scene.get("title") or scene.get("id") or "",
        "path": scene.get("path", ""),
        "source": source_ref(scene.get("path", ""), line_num),
        "role": directive,
    }


def extract_scene_asset_references(root: Path, scene: dict[str, Any]) -> list[dict[str, Any]]:
    rel = str(scene.get("path", ""))
    path = root / rel
    if not rel or not path.is_file():
        return []
    refs: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return []
    for line_num, line in enumerate(lines, 1):
        match = re.match(r"^\s*(card-image|face-image|set-bg|audio)\s*:\s*(.+)$", line, re.IGNORECASE)
        if not match:
            continue
        directive = match.group(1).lower()
        for asset_path in asset_paths_from_directive(match.group(2)):
            asset_type = asset_type_for_extension(Path(asset_path).suffix)
            if not asset_type:
                continue
            key = (asset_path, directive)
            if key in seen:
                continue
            seen.add(key)
            file_exists, preview_url = resolve_asset_reference(root, asset_path)
            ref: dict[str, Any] = {
                "path": asset_path,
                "name": Path(asset_path).name,
                "label": Path(asset_path).name,
                "type": asset_type,
                "extension": Path(asset_path).suffix.lower(),
                "sourceKind": "source_reference",
                "editability": "reference_only",
                "confidence": CONF_STATIC,
                "source": source_ref(rel, line_num),
                "directive": directive,
                "fileExists": file_exists,
            }
            if preview_url and preview_url != asset_path:
                ref["previewUrl"] = preview_url
            refs.append(ref)
    return refs


def append_asset_usage(item: dict[str, Any], usage: dict[str, Any]) -> None:
    usage_refs = item.setdefault("usageRefs", [])
    key = (
        usage.get("id", ""),
        usage.get("path", ""),
        (usage.get("source") or {}).get("line"),
        usage.get("role", ""),
    )
    for existing in usage_refs:
        existing_key = (
            existing.get("id", ""),
            existing.get("path", ""),
            (existing.get("source") or {}).get("line"),
            existing.get("role", ""),
        )
        if existing_key == key:
            return
    usage_refs.append(usage)


def extract_assets(root: Path, scenes: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    by_path: dict[str, dict[str, Any]] = {}

    def add_item(item: dict[str, Any]) -> dict[str, Any]:
        path_key = normalize_asset_path(item.get("path", ""))
        preview_key = normalize_asset_path(item.get("previewUrl", ""))
        existing = by_path.get(path_key) or (by_path.get(preview_key) if preview_key else None)
        if existing:
            for usage in item.get("usageRefs", []):
                append_asset_usage(existing, usage)
            if item.get("fileExists") and not existing.get("fileExists"):
                existing["fileExists"] = True
                if item.get("previewUrl"):
                    existing["previewUrl"] = item["previewUrl"]
            return existing
        items.append(item)
        by_path[path_key] = item
        if preview_key:
            by_path[preview_key] = item
        return item

    for rel_root in ASSET_SCAN_ROOTS:
        scan_root = root / rel_root
        if not scan_root.exists():
            continue
        for path in sorted(scan_root.rglob("*")):
            if not path.is_file():
                continue
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                continue
            if rel in seen:
                continue
            asset_type = asset_type_for_extension(path.suffix)
            if not asset_type:
                continue
            seen.add(rel)
            source_kind, editability, confidence = asset_source_kind(rel)
            try:
                size = path.stat().st_size
            except OSError:
                size = None
            item: dict[str, Any] = {
                "id": safe_asset_id(rel),
                "name": path.name,
                "type": asset_type,
                "path": rel,
                "extension": path.suffix.lower(),
                "sourceKind": source_kind,
                "editability": editability,
                "source": source_ref(rel),
                "confidence": confidence,
                "fileExists": True,
            }
            if size is not None:
                item["sizeBytes"] = size
            add_item(item)
    for scene in scenes or []:
        for ref in scene.get("assetRefs", []):
            asset_path = normalize_asset_path(ref.get("path", ""))
            if not asset_path:
                continue
            usage = asset_reference_usage(scene, (ref.get("source") or {}).get("line") or 0, ref.get("directive", "asset"))
            item = {
                "id": safe_asset_id(asset_path),
                "name": ref.get("name") or Path(asset_path).name,
                "label": ref.get("label") or ref.get("name") or Path(asset_path).name,
                "type": ref.get("type") or asset_type_for_extension(Path(asset_path).suffix) or "asset",
                "path": asset_path,
                "extension": ref.get("extension") or Path(asset_path).suffix.lower(),
                "sourceKind": ref.get("sourceKind") or "source_reference",
                "editability": ref.get("editability") or "reference_only",
                "source": ref.get("source") or source_ref(scene.get("path", "")),
                "confidence": ref.get("confidence") or CONF_STATIC,
                "fileExists": bool(ref.get("fileExists")),
                "usageRefs": [usage],
            }
            if ref.get("previewUrl"):
                item["previewUrl"] = ref["previewUrl"]
            add_item(item)
    return {
        "items": sorted(items, key=lambda item: (item["type"], item["path"])),
        "confidence": CONF_STATIC if items else CONF_OPAQUE,
    }


def stable_surface_id(rel: str, line_num: int, label: str) -> str:
    digest = hashlib.sha1(f"{rel}:{line_num}:{label}".encode("utf-8")).hexdigest()[:10]
    return f"surface_text_{digest}"


def stable_text_id(rel: str, line_num: int, role: str, text: str) -> str:
    digest = hashlib.sha1(f"{rel}:{line_num}:{role}:{text}".encode("utf-8")).hexdigest()[:12]
    return f"text_{digest}"


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


def strip_inline_conditionals(value: str) -> str:
    return re.sub(r"\[\?\s*if\s+.+?\s*:\s*.*?\s*\?\]", " ", value)


def extract_inline_conditionals(value: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for match in re.finditer(r"\[\?\s*if\s+(.+?)\s*:\s*(.*?)\s*\?\]", value):
        condition = compact_visible_text(match.group(1))
        text = compact_visible_text(match.group(2))
        if text:
            out.append((condition, text))
    return out


def text_item_editability(scene: dict[str, Any], role: str) -> str:
    if role in {"option_label", "title", "subtitle", "unavailable_text"}:
        return "draft_extractable"
    if scene.get("path") == POST_EVENT_REL or is_generated_artifact(str(scene.get("path", ""))):
        return "ide_escape_hatch"
    return "text_proposal"


def section_for_line(scene: dict[str, Any], line_num: int) -> dict[str, Any] | None:
    for section in scene.get("sections", []):
        span = section.get("sourceSpan") or {}
        start = span.get("startLine")
        end = span.get("endLine")
        if isinstance(start, int) and isinstance(end, int) and start <= line_num <= end:
            return section
    return None


def text_conditions(scene: dict[str, Any], section: dict[str, Any] | None,
                    inline_condition: str = "") -> list[str]:
    out: list[str] = []
    for value in [
        scene.get("viewIf"),
        section.get("viewIf") if section else "",
        section.get("chooseIf") if section else "",
        inline_condition,
    ]:
        if value:
            out.append(str(value))
    return out


def is_structural_scene_line(stripped: str) -> bool:
    if not stripped:
        return True
    if stripped.startswith("#"):
        return True
    if stripped.startswith(("{!", "!}", "@", "-", "=")):
        return True
    if is_hidden_script_or_comment_line(stripped):
        return True
    if re.match(r"^[A-Za-z][A-Za-z0-9_-]*\s*:", stripped):
        return True
    return False


def extract_text_corpus_from_scene(root: Path, scene: dict[str, Any]) -> list[dict[str, Any]]:
    rel = scene.get("path")
    if not isinstance(rel, str) or not rel or rel == POST_EVENT_REL or is_generated_artifact(rel):
        return []
    path = root / rel
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return []

    items: list[dict[str, Any]] = []
    paragraph: list[str] = []
    paragraph_start = 0
    paragraph_end = 0
    paragraph_section: dict[str, Any] | None = None
    in_magic = False
    section_spans: list[tuple[int, int, dict[str, Any]]] = []
    for section in scene.get("sections", []):
        span = section.get("sourceSpan") or {}
        start = span.get("startLine")
        end = span.get("endLine")
        if isinstance(start, int) and isinstance(end, int):
            section_spans.append((start, end, section))
    section_spans.sort(key=lambda item: item[0])
    section_index = 0
    active_section: dict[str, Any] | None = None

    def append_item(role: str, text: str, line_num: int, section: dict[str, Any] | None = None,
                    inline_condition: str = "", extra: dict[str, Any] | None = None,
                    end_line: int | None = None) -> None:
        value = compact_visible_text(text)
        if not value:
            return
        payload: dict[str, Any] = {
            "id": stable_text_id(rel, line_num, role, value),
            "role": role,
            "text": value,
            "owner": {
                "kind": "scene",
                "sceneId": scene.get("id", ""),
                "sectionId": section.get("id", "") if section else "",
                "sceneType": scene.get("type", "scene"),
            },
            "source": source_range_ref(rel, line_num, end_line or line_num),
            "confidence": CONF_STATIC,
            "editability": text_item_editability(scene, role),
        }
        conditions = text_conditions(scene, section, inline_condition)
        if conditions:
            payload["conditions"] = conditions
        if extra:
            payload.update(extra)
        items.append(payload)

    def flush_paragraph(next_line: int) -> None:
        nonlocal paragraph, paragraph_start, paragraph_end, paragraph_section
        if not paragraph:
            return
        append_item(
            "body",
            " ".join(paragraph),
            paragraph_start or next_line,
            paragraph_section,
            end_line=paragraph_end or paragraph_start or next_line,
        )
        paragraph = []
        paragraph_start = 0
        paragraph_end = 0
        paragraph_section = None

    for line_num, raw in enumerate(lines, 1):
        stripped = raw.strip()
        while section_index < len(section_spans) and line_num > section_spans[section_index][1]:
            section_index += 1
        if section_index < len(section_spans):
            start, end, section = section_spans[section_index]
            active_section = section if start <= line_num <= end else None
        else:
            active_section = None

        if in_magic:
            if "!}" in stripped:
                in_magic = False
            continue
        if "{!" in stripped:
            flush_paragraph(line_num)
            if "!}" not in stripped:
                in_magic = True
            continue

        heading = re.match(r"^\s*=\s*(.+?)\s*$", raw)
        if heading:
            flush_paragraph(line_num)
            append_item("heading", heading.group(1), line_num, active_section)
            continue

        option = re.match(r"^\s*-\s+@([A-Za-z0-9_.-]+)(?::\s*(.+?))?\s*$", raw)
        if option:
            flush_paragraph(line_num)
            label = option.group(2) or ""
            if label:
                append_item(
                    "option_label",
                    label,
                    line_num,
                    active_section,
                    extra={"optionId": option.group(1)}
                )
            continue

        metadata = re.match(r"^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+?)\s*$", raw)
        if metadata:
            flush_paragraph(line_num)
            role = TEXT_CORPUS_VISIBLE_METADATA.get(metadata.group(1))
            if role:
                append_item(role, metadata.group(2), line_num, active_section)
            continue

        if not stripped:
            flush_paragraph(line_num)
            continue

        if stripped.startswith("#") or stripped.startswith("@") or stripped.startswith("-"):
            flush_paragraph(line_num)
            continue

        conditional_items = extract_inline_conditionals(stripped)
        if conditional_items:
            flush_paragraph(line_num)
            for condition, text in conditional_items:
                append_item("conditional_body", text, line_num, active_section, condition)
            remainder = compact_visible_text(strip_inline_conditionals(stripped))
            if remainder and not is_structural_scene_line(remainder):
                append_item("body", remainder, line_num, active_section)
            continue

        if is_structural_scene_line(stripped):
            flush_paragraph(line_num)
            continue

        if not paragraph:
            paragraph_start = line_num
            paragraph_section = active_section
        paragraph.append(stripped)
        paragraph_end = line_num

    flush_paragraph(len(lines) + 1)
    return items


def ensure_news_text_items(news: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(news, dict):
        return out
    for item in news.get("items", []):
        headline = compact_visible_text(str(item.get("headline", "")))
        if not headline:
            continue
        source = item.get("source") or {}
        line = source_ref_line(source) or 1
        rel = str(source.get("path", "news"))
        out.append({
            "id": stable_text_id(rel, line, "news_headline", headline),
            "role": "news_headline",
            "text": headline,
            "owner": {"kind": "news", "delivery": item.get("delivery", "")},
            "source": source,
            "confidence": item.get("confidence", CONF_STATIC),
            "editability": "ide_escape_hatch",
        })
        description = compact_visible_text(str(item.get("description", "")))
        if description:
            out.append({
                "id": stable_text_id(rel, line, "news_description", description),
                "role": "news_description",
                "text": description,
                "owner": {"kind": "news", "delivery": item.get("delivery", "")},
                "source": source,
                "confidence": item.get("confidence", CONF_STATIC),
                "editability": "ide_escape_hatch",
            })
    for popup in news.get("eventPopups", []):
        excerpt = compact_visible_text(str(popup.get("description") or popup.get("excerpt") or ""))
        if not excerpt:
            continue
        source = popup.get("excerptSource") or popup.get("source") or {}
        line = source_ref_line(source) or 1
        rel = str(source.get("path", "monthly_popup"))
        out.append({
            "id": stable_text_id(rel, line, "monthly_popup_excerpt", excerpt),
            "role": "monthly_popup_excerpt",
            "text": excerpt,
            "owner": {
                "kind": "monthly_popup",
                "sceneId": popup.get("linkedSceneId", ""),
                "delivery": popup.get("delivery", ""),
            },
            "source": source,
            "confidence": popup.get("confidence", CONF_STATIC),
            "editability": "text_proposal",
        })
    return out


def extract_text_corpus(root: Path, scenes: list[dict[str, Any]],
                        semantic_news: dict[str, Any],
                        surface_text: dict[str, Any]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    sources: set[str] = set()
    truncated = False

    def append_many(candidates: list[dict[str, Any]]) -> None:
        nonlocal truncated
        for item in candidates:
            if len(items) >= TEXT_CORPUS_MAX_ITEMS:
                truncated = True
                return
            items.append(item)
            source = item.get("source", {})
            if source.get("path"):
                sources.add(str(source["path"]))

    for scene in scenes:
        append_many(extract_text_corpus_from_scene(root, scene))
        if truncated:
            break

    if not truncated:
        append_many(ensure_news_text_items(semantic_news))

    if not truncated:
        for surface_item in (surface_text.get("items", []) if isinstance(surface_text, dict) else []):
            label = compact_visible_text(str(surface_item.get("label", "")))
            if not label:
                continue
            source = surface_item.get("source") or {}
            line = source_ref_line(source) or 1
            rel = str(source.get("path", "surface_text"))
            append_many([{
                "id": stable_text_id(rel, line, "surface_label", label),
                "role": "surface_label",
                "text": label,
                "owner": {
                    "kind": "surface_text",
                    "itemId": surface_item.get("id", ""),
                    "area": surface_item.get("area", ""),
                    "variableName": surface_item.get("variableName", ""),
                },
                "source": source,
                "confidence": surface_item.get("confidence", CONF_STATIC),
                "editability": surface_item.get("editability", "ide_escape_hatch"),
            }])
            if truncated:
                break

    return {
        "sources": sorted(sources),
        "items": items,
        "confidence": CONF_STATIC if items else CONF_OPAQUE,
        "truncated": truncated,
    }


def surface_area_for_path(rel: str) -> str:
    if rel.startswith("source/qdisplays/"):
        return "qdisplay"
    if rel == "source/scenes/root.scene.dry":
        return "opening_text"
    if rel.startswith("source/scenes/status"):
        return "status_scene"
    if rel == "out/html/index.html" or rel.endswith("/sidebar-ui.js"):
        return "html_sidebar"
    if rel.endswith("/strategy-sidebar.js"):
        return "html_strategy_sidebar"
    if rel.endswith("/header-ui.js"):
        return "html_header"
    if rel.startswith("out/html/"):
        return "html_ui"
    return "source_text"


def surface_editability_for_path(rel: str) -> str:
    return "ide_escape_hatch" if rel.startswith("out/html/") else "draft_exportable"


def surface_reason_for_path(rel: str) -> str:
    if rel.startswith("out/html/"):
        return "Generated/custom runtime UI evidence; Studio can guide the IDE edit but will not auto-edit it."
    return "Source-backed Dendry display text; Studio can export a replacement proposal for manual review."


def surface_confidence_for_path(rel: str) -> str:
    return CONF_PROFILE if rel.startswith("out/html/") else CONF_STATIC


def candidate_surface_files(root: Path) -> list[str]:
    rels: set[str] = set()
    for pattern in SURFACE_TEXT_SOURCE_PATTERNS:
        for path in root.glob(pattern):
            if path.is_file():
                rels.add(posix_rel(path, root))
    for rel in SURFACE_TEXT_HTML_EVIDENCE:
        if (root / rel).is_file():
            rels.add(rel)
    return sorted(rels)


def variable_near_line(line: str, variable_names: set[str]) -> str | None:
    for name in sorted(variable_names, key=len, reverse=True):
        if re.search(rf"\b{re.escape(name)}\b", line):
            return name
    return None


def looks_like_player_prose_line(text: str) -> bool:
    value = text.strip()
    if len(value) < 40 or len(value) > 360:
        return False
    if value.startswith(("@", "-", "//", "{!", "!}", "=")):
        return False
    if re.match(r"^[A-Za-z-]+:\s*", value):
        return False
    if value[0] in {"'", '"'} and re.search(r"['\"]\s*,", value):
        return False
    if re.search(r"\b(var|return)\b|^\s*(if|else|for|while)\s*\(|Q\.|this\.|=>|;\s*$", value):
        return False
    if "[?" in value or "{!" in value or "!}" in value:
        return False
    return bool(re.search(r"[A-Za-z\u4e00-\u9fff]", value))


DRY_SURFACE_DIRECTIVE_LABELS = {
    "audio",
    "card-image",
    "choose-if",
    "description",
    "face-image",
    "frequency",
    "go-to",
    "id",
    "is-special",
    "new-page",
    "on-arrival",
    "set-bg",
    "subtitle",
    "tags",
    "title",
}


def looks_like_dry_source_ui_label(text: str) -> bool:
    value = clean_ui_label(text).strip(" -—|")
    if not value:
        return False
    normalized = re.sub(r"[\s_]+", "-", value.lower())
    if normalized in DRY_SURFACE_DIRECTIVE_LABELS:
        return False
    if any(token in value for token in ("[?", "[+", "{!", "!}", "<", ">", "=")):
        return False
    return looks_like_short_ui_label(value, allow_english=True)


def extract_dry_surface_labels(line: str, *, include_prose: bool = False) -> list[str]:
    labels: list[str] = []

    def add_label(value: str) -> None:
        label = clean_ui_label(value).strip(" -—|")
        if label and label not in labels:
            labels.append(label)

    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return labels
    heading = re.match(r"^=+\s*([^\[\{:=：]{1,28})\s*$", stripped)
    if heading:
        add_label(heading.group(1))
    line_start_label = re.match(r"^([^:\[\]<>{}=]{1,40})\s*:\s+", stripped)
    if line_start_label and looks_like_dry_source_ui_label(line_start_label.group(1)):
        add_label(line_start_label.group(1))
    for match in re.finditer(r"(?<![\w])([\u4e00-\u9fffA-Za-z0-9% ／/・·（）()《》]{1,24})\s*[:：]", stripped):
        label = match.group(1).strip(" -—|")
        if label and re.search(r"[\u4e00-\u9fff]", label):
            add_label(label)
    if include_prose and looks_like_player_prose_line(stripped):
        add_label(stripped)
    return labels


def clean_ui_label(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().strip(":：")


def looks_like_short_ui_label(text: str, *, allow_english: bool = False) -> bool:
    value = text.strip()
    if len(value) < 1 or len(value) > 24:
        return False
    has_cjk = bool(re.search(r"[\u4e00-\u9fff]", value))
    has_english = bool(re.search(r"[A-Za-z]", value))
    if not has_cjk and not (allow_english and has_english):
        return False
    if re.search(r"[。！？；，,]|\\n|[{}=;]", value):
        return False
    if allow_english and has_english and not has_cjk:
        if "_" in value or re.search(r"https?://|\.js|\.css|\.html", value, re.IGNORECASE):
            return False
        if len(re.findall(r"[A-Za-z]+", value)) > 4:
            return False
    if value.count(" ") > 3:
        return False
    return True


def extract_html_surface_labels(line: str) -> list[str]:
    labels: list[str] = []
    for match in re.finditer(r"['\"]([^'\"]{1,40})['\"]", line):
        value = clean_ui_label(match.group(1))
        if looks_like_short_ui_label(value):
            labels.append(value)
    for match in re.finditer(r">([^<>{}]{1,40})<", line):
        value = clean_ui_label(match.group(1))
        if looks_like_short_ui_label(value, allow_english=True):
            labels.append(value)
    return labels


def extract_surface_text(root: Path, variables: list[dict[str, Any]]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, int, str]] = set()
    sources: list[str] = []
    variable_names = {str(variable.get("name", "")) for variable in variables if variable.get("name")}
    for rel in candidate_surface_files(root):
        path = root / rel
        sources.append(rel)
        try:
            text = read_text_prefix(path, SURFACE_TEXT_MAX_FILE_CHARS)
        except Exception:
            continue
        html_source = rel.startswith("out/html/")
        include_prose = rel == "source/scenes/root.scene.dry"
        extractor = extract_html_surface_labels if html_source else None
        for line_num, line in enumerate(text.splitlines(), 1):
            labels = extractor(line) if extractor else extract_dry_surface_labels(line, include_prose=include_prose)
            if not labels:
                continue
            for label in labels:
                key = (rel, line_num, label)
                if key in seen:
                    continue
                seen.add(key)
                item: dict[str, Any] = {
                    "id": stable_surface_id(rel, line_num, label),
                    "label": label,
                    "area": surface_area_for_path(rel),
                    "source": source_ref(rel, line_num),
                    "confidence": surface_confidence_for_path(rel),
                    "editability": surface_editability_for_path(rel),
                    "reason": surface_reason_for_path(rel),
                    "originalText": line.strip() if include_prose and label == line.strip() else truncate_excerpt_line(line.strip()),
                }
                variable_name = variable_near_line(line, variable_names)
                if variable_name:
                    item["variableName"] = variable_name
                items.append(item)
                if len(items) >= SURFACE_TEXT_MAX_ITEMS:
                    return {"sources": sources, "items": items, "confidence": CONF_STATIC}
    return {"sources": sources, "items": items, "confidence": CONF_STATIC if items else CONF_OPAQUE}


def parser_diagnostics(parser_index: dict[str, Any], root: Path) -> list[dict[str, Any]]:
    out = []
    for diag in parser_index.get("diagnostics", []):
        path = diag.get("path", "")
        out.append({
            "severity": diag.get("severity", "error"),
            "code": f"project_map.parser.{diag.get('phase', 'parse')}",
            "message": diag.get("message", "Parser diagnostic"),
            "path": path,
            "source": source_ref(path, diag.get("line")),
            "confidence": CONF_EXACT,
        })
    if parser_index.get("_stderr"):
        out.append({
            "severity": "info",
            "code": "project_map.parser.stderr",
            "message": parser_index["_stderr"].splitlines()[0],
            "confidence": CONF_OPAQUE,
        })
    return out


def scan_post_event_targeted(root: Path) -> dict[str, Any] | None:
    path = root / POST_EVENT_REL
    if not path.exists():
        return None

    line_count = 0
    routes: list[dict[str, Any]] = []
    anchors: list[dict[str, Any]] = []
    tag_choices: list[dict[str, Any]] = []
    current_anchor = ""
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for line_num, line in enumerate(handle, 1):
                if line_num > MAX_POST_EVENT_TARGETED_LINES:
                    break
                line_count = line_num
                anchor_match = re.match(r"^\s*@([A-Za-z0-9_.-]+)\s*$", line)
                if anchor_match:
                    current_anchor = anchor_match.group(1)
                    anchors.append({"id": current_anchor, "line": line_num})
                    continue
                tag_match = re.match(r"^\s*-\s*#([A-Za-z0-9_-]+)\b", line)
                if tag_match:
                    tag_choices.append({
                        "tag": tag_match.group(1),
                        "anchor": current_anchor,
                        "line": line_num,
                    })
                    continue
                match = re.match(r"^\s*go-to:\s*(.+)$", line)
                if not match:
                    continue
                routes.append({
                    "line": line_num,
                    "routes": parse_route_clauses(match.group(1)),
                })
    except Exception:
        return {
            "lineCount": None,
            "routes": [],
            "anchors": [],
            "tagChoices": [],
        }

    return {
        "lineCount": line_count or None,
        "routes": routes,
        "anchors": anchors,
        "tagChoices": tag_choices,
    }


def synthetic_post_event_scene(summary: dict[str, Any] | None) -> dict[str, Any] | None:
    if summary is None:
        return None
    line_count = summary.get("lineCount") or 1
    return {
        "id": "post_event",
        "name": "post_event",
        "title": "",
        "path": POST_EVENT_REL,
        "type": "monthly_router",
        "profileId": None,
        "confidence": CONF_OPAQUE,
        "classificationConfidence": CONF_OPAQUE,
        "sourceSpan": {"path": POST_EVENT_REL, "startLine": 1, "endLine": line_count},
        "topLevelSpan": {"path": POST_EVENT_REL, "startLine": 1, "endLine": line_count},
        "metadata": {},
        "tags": [],
        "flags": {
            "isCard": False,
            "isPinnedCard": False,
            "isHand": False,
            "isDeck": False,
            "isSpecial": False,
        },
        "routes": {},
        "options": [],
        "sections": [],
        "opaque": True,
    }


def post_event_targeted_edges(summary: dict[str, Any] | None,
                              graph: GraphBuilder) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if summary is None:
        return [], []
    edges: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for item in summary.get("routes", []):
        line = item.get("line")
        src = source_ref(POST_EVENT_REL, line)
        for route in item.get("routes", []):
            raw_target = route.get("id", "").strip()
            if not raw_target:
                continue
            resolved, ok = graph.resolve_target(raw_target, "post_event", prefer_local_anchor=False)
            edge: dict[str, Any] = {
                "from": "post_event",
                "to": resolved,
                "kind": "conditional_go_to" if route.get("predicate") else "go_to",
                "rawTarget": raw_target,
                "confidence": CONF_STATIC,
                "parserBacked": False,
                "source": src,
            }
            if route.get("predicate"):
                edge["condition"] = route["predicate"]
            edges.append(edge)
            if not ok:
                diagnostics.append({
                    "severity": "warning",
                    "code": "project_map.missing_target",
                    "message": f"post_event targeted go-to target '{raw_target}' could not be resolved",
                    "path": POST_EVENT_REL,
                    "sceneId": "post_event",
                    "source": src,
                    "target": resolved,
                    "confidence": CONF_STATIC,
                })
    return edges, diagnostics


def build_index(
    root: Path,
    include_excerpts: bool = False,
    excerpt_context_lines: int = 1,
    parser_index: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    info = parse_info(root)
    if parser_index is None:
        parser_index = run_node_parser(root)
    selected_profiles = score_profiles(root, parser_index)
    post_event_summary = scan_post_event_targeted(root)

    scenes = [
        normalize_parser_scene(scene, root, selected_profiles)
        for scene in parser_index.get("scenes", [])
    ]
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

    variables, variable_diagnostics, variable_summary = VariableScanner(root).scan()
    semantic = classify_semantics(root, scenes, variables, selected_profiles, post_event_summary)

    diagnostics = (
        parser_diagnostics(parser_index, root)
        + graph_diagnostics
        + post_event_diagnostics
        + overlay_diagnostics
        + variable_diagnostics
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
