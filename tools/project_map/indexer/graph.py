from .common import *

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
