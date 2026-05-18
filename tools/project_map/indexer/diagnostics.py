from .common import *
from .assets import active_asset_directive_lines, normalize_asset_directive
from .graph import GraphBuilder, parse_route_clauses


ASSET_DIRECTIVE_RE = re.compile(
    r"^\s*(card[-_ ]?image|face[-_ ]?image|set[-_ ]?bg|set[-_ ]?music|set[-_ ]?sprites|audio)\s*:\s*(.+)$",
    re.IGNORECASE,
)

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


def inert_metadata_directive_diagnostics(root: Path, scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for scene in scenes:
        rel = str(scene.get("path", ""))
        if not rel or scene.get("opaque"):
            continue
        path = root / rel
        if not path.is_file():
            continue
        active_lines = active_asset_directive_lines(scene)
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for line_num, line in enumerate(lines, 1):
            match = ASSET_DIRECTIVE_RE.match(line)
            if not match:
                continue
            directive = normalize_asset_directive(match.group(1))
            if (line_num, directive) in active_lines:
                continue
            diagnostics.append({
                "severity": "warning",
                "code": "project_map.inert_metadata_directive",
                "message": (
                    f"{directive} at line {line_num} appears inside rendered content, "
                    "so Dendry will not treat it as metadata. Move it before the section body."
                ),
                "path": rel,
                "sceneId": scene.get("id", ""),
                "source": source_ref(rel, line_num),
                "directive": directive,
                "confidence": CONF_EXACT,
            })
    return diagnostics


def scan_post_event_targeted(root: Path) -> dict[str, Any] | None:
    path = root / POST_EVENT_REL
    if not path.exists():
        return None

    line_count = 0
    routes: list[dict[str, Any]] = []
    anchors: list[dict[str, Any]] = []
    choices: list[dict[str, Any]] = []
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
                    title_match = re.match(r"^\s*-\s*#[A-Za-z0-9_-]+\s*:\s*(.+?)\s*$", line)
                    choices.append({
                        "target": f"#{tag_match.group(1)}",
                        "title": title_match.group(1).strip() if title_match else "",
                        "anchor": current_anchor,
                        "line": line_num,
                        "anchorText": line.rstrip("\n"),
                        "kind": "tag_choice",
                    })
                    tag_choices.append({
                        "tag": tag_match.group(1),
                        "anchor": current_anchor,
                        "line": line_num,
                    })
                    continue
                choice_match = re.match(r"^\s*-\s*@([A-Za-z0-9_.-]+)\s*:\s*(.+?)\s*$", line)
                if choice_match:
                    choices.append({
                        "target": choice_match.group(1),
                        "title": choice_match.group(2).strip(),
                        "anchor": current_anchor,
                        "line": line_num,
                        "anchorText": line.rstrip("\n"),
                        "kind": "scene_choice",
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
            "choices": [],
            "tagChoices": [],
        }

    return {
        "lineCount": line_count or None,
        "routes": routes,
        "anchors": anchors,
        "choices": choices,
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
        "options": [
            {
                "target": {"id": choice.get("target", "")},
                "title": choice.get("title", ""),
                "sourceSpan": {
                    "path": POST_EVENT_REL,
                    "line": choice.get("line"),
                    "startLine": choice.get("line"),
                    "endLine": choice.get("line"),
                    "anchorText": choice.get("anchorText", ""),
                    "endAnchorText": choice.get("anchorText", ""),
                },
                "kind": choice.get("kind", "scene_choice"),
            }
            for choice in summary.get("choices", [])
        ],
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
