from .common import *
from .text_corpus import stable_surface_id

VARIABLE_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
VARIABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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


def prepare_variable_name_lookup(variable_names: set[str]) -> dict[str, tuple[str, ...]]:
    names = {str(name) for name in variable_names if name}
    ordered = sorted(names, key=lambda name: (-len(name), name))
    return {
        "simple": tuple(name for name in ordered if VARIABLE_NAME_RE.match(name)),
        "complex": tuple(name for name in ordered if not VARIABLE_NAME_RE.match(name)),
    }


def variable_near_line(line: str, variable_lookup: dict[str, tuple[str, ...]] | set[str]) -> str | None:
    lookup = (
        variable_lookup
        if isinstance(variable_lookup, dict)
        else prepare_variable_name_lookup(variable_lookup)
    )
    tokens = set(VARIABLE_TOKEN_RE.findall(line))
    for name in lookup.get("simple", ()):
        if name in tokens:
            return name
    for name in lookup.get("complex", ()):
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
    variable_lookup = prepare_variable_name_lookup(variable_names)
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
                variable_name = variable_near_line(line, variable_lookup)
                if variable_name:
                    item["variableName"] = variable_name
                items.append(item)
                if len(items) >= SURFACE_TEXT_MAX_ITEMS:
                    return {"sources": sources, "items": items, "confidence": CONF_STATIC}
    return {"sources": sources, "items": items, "confidence": CONF_STATIC if items else CONF_OPAQUE}
