from html.parser import HTMLParser
import posixpath

from .common import *

RUNTIME_HTML_ROOT = "out/html"
RUNTIME_INDEX_REL = "out/html/index.html"
RUNTIME_FILE_LIMIT = 1024 * 1024

EVENT_HANDLER_ATTRS = {
    "onclick",
    "onchange",
    "oninput",
    "onsubmit",
    "onkeyup",
    "onkeydown",
    "onmousedown",
    "onmouseup",
}

CONTROL_TAGS = {"a", "button", "input", "select", "textarea", "option"}
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

REGION_ID_ROLES = {
    "page": ("app_shell", "Page"),
    "mid_panel": ("main_panel", "Main panel"),
    "content": ("content", "Story content"),
    "tools_wrapper": ("tools", "Tools"),
    "options": ("options_overlay", "Options overlay"),
    "save": ("save_overlay", "Save overlay"),
    "stats_sidebar": ("left_sidebar", "Left sidebar"),
    "stats_sidebar_right": ("right_sidebar", "Right sidebar"),
    "bg1": ("background", "Background layer"),
    "bg2": ("background", "Background layer"),
}

REGION_CLASS_ROLES = {
    "choices": ("choices", "Choices"),
    "background": ("background", "Background"),
    "hand": ("card_hand", "Card hand"),
    "pinned-cards": ("pinned_cards", "Pinned cards"),
    "deck": ("deck", "Deck"),
    "card-img": ("card_image", "Card image"),
    "card-tooltip": ("card_tooltip", "Card tooltip"),
    "face-figure": ("portrait", "Portrait figure"),
    "face-figure2": ("portrait", "Portrait figure"),
    "face-img": ("portrait_image", "Portrait image"),
}

RUNTIME_CONVENTION_REGIONS = (
    ("ul.choices", "choices", "Choices"),
)

MEDIA_REF_RE = re.compile(
    r"(?P<url>[^'\"\s()<>]+?\.(?:png|jpe?g|gif|webp|svg|mp3|ogg|wav|flac|m4a))",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(r"url\(\s*['\"]?([^'\"\)]+)['\"]?\s*\)", re.IGNORECASE)
HTML_ATTR_ASSET_ATTRS = {"src", "href", "poster"}
URL_SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")


def clean_runtime_label(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def safe_runtime_id(value: str, fallback: str = "runtime") -> str:
    base = re.sub(r"[^A-Za-z0-9_]+", "_", str(value or "")).strip("_").lower()
    return base or fallback


def line_for_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, max(0, offset)) + 1


def strip_css_comments_preserve_lines(text: str) -> str:
    def replacement(match: re.Match[str]) -> str:
        value = match.group(0)
        return "".join("\n" if char == "\n" else " " for char in value)

    return re.sub(r"/\*.*?\*/", replacement, text, flags=re.DOTALL)


def clean_url_ref(value: str) -> str:
    ref = str(value or "").strip().strip("'\"")
    if not ref:
        return ""
    return ref.split("#", 1)[0].split("?", 1)[0].strip()


def is_external_ref(value: str) -> bool:
    ref = str(value or "").strip()
    return bool(
        ref.startswith("//")
        or URL_SCHEME_RE.match(ref)
        or ref.startswith(("data:", "javascript:", "mailto:", "about:"))
    )


def runtime_ref(root: Path, base_rel: str, value: str) -> dict[str, Any]:
    raw = str(value or "").strip()
    cleaned = clean_url_ref(raw)
    out: dict[str, Any] = {"raw": raw}
    if not cleaned:
        out["external"] = False
        out["path"] = ""
        out["exists"] = False
        return out
    if is_external_ref(cleaned):
        out["url"] = raw
        out["external"] = True
        return out
    if cleaned.startswith("/"):
        rel = posixpath.normpath(f"{RUNTIME_HTML_ROOT}/{cleaned.lstrip('/')}")
    else:
        rel = posixpath.normpath(posixpath.join(posixpath.dirname(base_rel), cleaned))
    out["path"] = rel
    out["external"] = False
    out["exists"] = (root / rel).is_file()
    return out


def source_line(rel: str, line: int | None) -> dict[str, Any]:
    return source_ref(rel, line if isinstance(line, int) and line > 0 else None)


def runtime_diagnostic(
    severity: str,
    code: str,
    message: str,
    path: str | None = None,
    line: int | None = None,
    **extra: Any,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "severity": severity,
        "code": code,
        "message": message,
        "confidence": CONF_EXACT if code.startswith("runtime_surface.missing") else CONF_STATIC,
    }
    if path:
        out["path"] = path
        out["source"] = source_line(path, line)
    out.update(extra)
    return out


def selector_for(tag: str, attrs: dict[str, str]) -> str:
    element_id = attrs.get("id", "").strip()
    if element_id:
        return f"#{element_id}"
    classes = [part for part in attrs.get("class", "").split() if part]
    if classes:
        return tag + "".join(f".{part}" for part in classes[:3])
    return tag


def region_roles_for_element(tag: str, attrs: dict[str, str]) -> list[tuple[str, str, str]]:
    roles: list[tuple[str, str, str]] = []
    element_id = attrs.get("id", "").strip()
    if element_id in REGION_ID_ROLES:
        role, label = REGION_ID_ROLES[element_id]
        roles.append((f"#{element_id}", role, label))
    for class_name in attrs.get("class", "").split():
        if class_name in REGION_CLASS_ROLES:
            role, label = REGION_CLASS_ROLES[class_name]
            selector = f"{tag}.{class_name}" if tag else f".{class_name}"
            roles.append((selector, role, label))
    return roles


def role_for_selector(selector: str) -> tuple[str, str] | None:
    value = str(selector or "").strip()
    for element_id, role_info in REGION_ID_ROLES.items():
        if re.search(rf"(?<![\w-])#{re.escape(element_id)}(?![\w-])", value):
            return role_info
    for class_name, role_info in REGION_CLASS_ROLES.items():
        if re.search(rf"(?<![\w-])\.{re.escape(class_name)}(?![\w-])", value):
            return role_info
    return None


def add_region(
    regions: list[dict[str, Any]],
    seen: set[tuple[str, str]],
    selector: str,
    role: str,
    label: str,
    rel: str,
    line: int | None,
    evidence_kind: str,
) -> None:
    selector = selector.strip()
    if not selector:
        return
    key = (selector, role)
    evidence = {
        "kind": evidence_kind,
        "source": source_line(rel, line),
    }
    if key in seen:
        for region in regions:
            if region.get("selector") == selector and region.get("role") == role:
                region.setdefault("evidence", []).append(evidence)
                return
    seen.add(key)
    regions.append({
        "id": safe_runtime_id(f"{role}_{selector}", "region"),
        "role": role,
        "label": label,
        "selector": selector,
        "source": source_line(rel, line),
        "confidence": CONF_STATIC,
        "editability": "ide_escape_hatch",
        "evidence": [evidence],
    })


def add_asset_ref(
    root: Path,
    refs: list[dict[str, Any]],
    seen: set[tuple[str, str]],
    base_rel: str,
    value: str,
    rel: str,
    line: int | None,
    role: str,
) -> None:
    resolved = runtime_ref(root, base_rel, value)
    path_value = resolved.get("path") or resolved.get("url") or resolved.get("raw") or ""
    if not path_value or Path(clean_url_ref(path_value)).suffix.lower() not in MEDIA_ASSET_EXTENSIONS:
        return
    key = (path_value, role)
    if key in seen:
        return
    seen.add(key)
    extension = Path(clean_url_ref(path_value)).suffix.lower()
    asset_type = "audio" if extension in AUDIO_ASSET_EXTENSIONS else "image"
    item: dict[str, Any] = {
        "path": path_value,
        "name": Path(clean_url_ref(path_value)).name or path_value,
        "type": asset_type,
        "extension": extension,
        "role": role,
        "source": source_line(rel, line),
        "confidence": CONF_STATIC,
    }
    if resolved.get("external"):
        item["external"] = True
    else:
        item["fileExists"] = bool(resolved.get("exists"))
    refs.append(item)


def add_library(
    libraries: list[dict[str, Any]],
    seen: set[str],
    library_id: str,
    name: str,
    rel: str,
    line: int | None,
    evidence: str,
) -> None:
    if library_id in seen:
        return
    seen.add(library_id)
    libraries.append({
        "id": library_id,
        "name": name,
        "source": source_line(rel, line),
        "evidence": evidence,
        "confidence": CONF_STATIC,
    })


def libraries_from_ref(value: str) -> list[tuple[str, str]]:
    lowered = str(value or "").lower()
    out: list[tuple[str, str]] = []
    if "jquery" in lowered:
        out.append(("jquery", "jQuery"))
    if "d3-parliament" in lowered or "parliament" in lowered:
        out.append(("d3-parliament", "D3 Parliament"))
    if "d3-linegraph" in lowered or "linegraph" in lowered:
        out.append(("d3-linegraph", "D3 Line Graph"))
    if re.search(r"(^|[./_-])d3(?:\.v?\d+)?(?:\.min)?\.js", lowered) or "d3." in lowered:
        out.append(("d3", "D3"))
    if lowered.endswith("core.js") or "dendry" in lowered:
        out.append(("dendry-runtime", "Dendry runtime"))
    return out


class RuntimeHtmlParser(HTMLParser):
    def __init__(self, root: Path, rel: str) -> None:
        super().__init__(convert_charrefs=True)
        self.root = root
        self.rel = rel
        self.scripts: list[dict[str, Any]] = []
        self.stylesheets: list[dict[str, Any]] = []
        self.regions: list[dict[str, Any]] = []
        self.controls: list[dict[str, Any]] = []
        self.asset_refs: list[dict[str, Any]] = []
        self.region_seen: set[tuple[str, str]] = set()
        self.asset_seen: set[tuple[str, str]] = set()
        self.stack: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._start_element(tag, attrs, is_self_closing=False)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._start_element(tag, attrs, is_self_closing=True)

    def handle_data(self, data: str) -> None:
        text = clean_runtime_label(data)
        if not text:
            return
        for item in self.stack:
            item.setdefault("text", []).append(text)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        index = len(self.stack) - 1
        while index >= 0:
            item = self.stack.pop()
            self._maybe_add_control(item)
            if item.get("tag") == tag:
                break
            index -= 1

    def _start_element(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
        *,
        is_self_closing: bool,
    ) -> None:
        tag = tag.lower()
        attr_map = {str(key).lower(): str(value or "") for key, value in attrs}
        line, _column = self.getpos()
        for selector, role, label in region_roles_for_element(tag, attr_map):
            add_region(self.regions, self.region_seen, selector, role, label, self.rel, line, "html")
        if tag == "script" and attr_map.get("src"):
            dep = runtime_ref(self.root, self.rel, attr_map["src"])
            dep.update({
                "src": attr_map["src"],
                "source": source_line(self.rel, line),
            })
            self.scripts.append(dep)
        if tag == "link" and attr_map.get("href"):
            rel_attr = attr_map.get("rel", "").lower()
            if "stylesheet" in rel_attr:
                dep = runtime_ref(self.root, self.rel, attr_map["href"])
                dep.update({
                    "href": attr_map["href"],
                    "source": source_line(self.rel, line),
                })
                self.stylesheets.append(dep)
            elif Path(clean_url_ref(attr_map["href"])).suffix.lower() in MEDIA_ASSET_EXTENSIONS:
                add_asset_ref(self.root, self.asset_refs, self.asset_seen, self.rel, attr_map["href"], self.rel, line, "html_link")
        for attr_name in HTML_ATTR_ASSET_ATTRS:
            if attr_name in attr_map and tag != "script":
                add_asset_ref(self.root, self.asset_refs, self.asset_seen, self.rel, attr_map[attr_name], self.rel, line, f"html_{tag}_{attr_name}")
        element = {
            "tag": tag,
            "attrs": attr_map,
            "line": line,
            "text": [],
        }
        if is_self_closing or tag in VOID_TAGS:
            self._maybe_add_control(element)
            return
        self.stack.append(element)

    def _maybe_add_control(self, item: dict[str, Any]) -> None:
        tag = item.get("tag", "")
        attrs = item.get("attrs", {})
        handlers = {
            name: value
            for name, value in attrs.items()
            if name in EVENT_HANDLER_ATTRS and value.strip()
        }
        is_control = tag in CONTROL_TAGS or bool(handlers)
        if not is_control:
            return
        label = clean_runtime_label(
            attrs.get("aria-label")
            or attrs.get("title")
            or attrs.get("value")
            or attrs.get("alt")
            or " ".join(item.get("text", []))
        )
        if not label and not handlers:
            return
        selector = selector_for(tag, attrs)
        control: dict[str, Any] = {
            "id": safe_runtime_id(f"{tag}_{selector}_{item.get('line')}_{label}", "control"),
            "tag": tag,
            "selector": selector,
            "label": label,
            "source": source_line(self.rel, item.get("line")),
            "confidence": CONF_STATIC,
            "editability": "ide_escape_hatch",
        }
        if handlers:
            control["handlers"] = handlers
        control["role"] = "control"
        self.controls.append(control)


def parse_html(root: Path, rel: str, text: str) -> dict[str, Any]:
    parser = RuntimeHtmlParser(root, rel)
    parser.feed(text)
    parser.close()
    return {
        "scripts": parser.scripts,
        "stylesheets": parser.stylesheets,
        "regions": parser.regions,
        "controls": parser.controls,
        "assetRefs": parser.asset_refs,
    }


def extract_css_surface(
    root: Path,
    rel: str,
    text: str,
    regions: list[dict[str, Any]],
    region_seen: set[tuple[str, str]],
    asset_refs: list[dict[str, Any]],
    asset_seen: set[tuple[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    selector_text = strip_css_comments_preserve_lines(text)
    css_variables: list[dict[str, Any]] = []
    seen_variables: set[str] = set()
    for match in re.finditer(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);", text):
        name = match.group(1)
        if name in seen_variables:
            continue
        seen_variables.add(name)
        css_variables.append({
            "name": name,
            "value": clean_runtime_label(match.group(2)),
            "source": source_line(rel, line_for_offset(text, match.start())),
            "confidence": CONF_STATIC,
        })
    for match in re.finditer(r"([^{}]+)\{", selector_text):
        line = line_for_offset(selector_text, match.start())
        for raw_selector in match.group(1).split(","):
            selector = clean_runtime_label(raw_selector)
            if not selector or selector.startswith("@"):
                continue
            role_info = role_for_selector(selector)
            if role_info:
                role, label = role_info
                add_region(regions, region_seen, selector, role, label, rel, line, "css")
    for match in CSS_URL_RE.finditer(text):
        add_asset_ref(root, asset_refs, asset_seen, rel, match.group(1), rel, line_for_offset(text, match.start()), "css_url")
    return css_variables, asset_refs


def extract_js_surface(
    root: Path,
    rel: str,
    text: str,
    regions: list[dict[str, Any]],
    region_seen: set[tuple[str, str]],
    asset_refs: list[dict[str, Any]],
    asset_seen: set[tuple[str, str]],
    libraries: list[dict[str, Any]],
    library_seen: set[str],
) -> list[dict[str, Any]]:
    hooks: list[dict[str, Any]] = []
    seen_hooks: set[str] = set()
    for match in re.finditer(r"\bwindow\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=", text):
        name = match.group(1)
        if name not in seen_hooks:
            seen_hooks.add(name)
            hooks.append({
                "name": name,
                "kind": "window_assignment",
                "source": source_line(rel, line_for_offset(text, match.start())),
                "confidence": CONF_STATIC,
            })
    for match in re.finditer(r"\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", text):
        name = match.group(1)
        if name not in seen_hooks:
            seen_hooks.add(name)
            hooks.append({
                "name": name,
                "kind": "function",
                "source": source_line(rel, line_for_offset(text, match.start())),
                "confidence": CONF_STATIC,
            })
    selector_patterns = [
        r"\bgetElementById\(\s*['\"]([^'\"]+)['\"]\s*\)",
        r"\bquerySelector(?:All)?\(\s*['\"]([^'\"]+)['\"]\s*\)",
        r"\bd3\.select(?:All)?\(\s*['\"]([^'\"]+)['\"]\s*\)",
        r"\$\(\s*['\"]([^'\"]+)['\"]\s*\)",
    ]
    for pattern in selector_patterns:
        for match in re.finditer(pattern, text):
            selector = match.group(1)
            if pattern.startswith(r"\bgetElementById"):
                selector = f"#{selector}"
            role_info = role_for_selector(selector)
            if role_info:
                role, label = role_info
                add_region(regions, region_seen, selector, role, label, rel, line_for_offset(text, match.start()), "js_selector")
    for match in MEDIA_REF_RE.finditer(text):
        add_asset_ref(root, asset_refs, asset_seen, rel, match.group("url"), rel, line_for_offset(text, match.start()), "js_string")
    for library_id, name in libraries_from_ref(text):
        add_library(libraries, library_seen, library_id, name, rel, None, "js_reference")
    return hooks


def dependency_diagnostics(scripts: list[dict[str, Any]], stylesheets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    missing_scripts = [item for item in scripts if item.get("external") is False and not item.get("exists")]
    missing_stylesheets = [item for item in stylesheets if item.get("external") is False and not item.get("exists")]
    for item in missing_scripts:
        src = item.get("source") or {}
        path = item.get("path") or item.get("src") or "runtime script"
        diagnostics.append(runtime_diagnostic(
            "error",
            "runtime_surface.missing_script",
            f"Runtime HTML references missing script {path}. Quick Runtime Lens needs a full build or a complete out/html checkout.",
            src.get("path"),
            src.get("line"),
            missingPath=path,
        ))
    for item in missing_stylesheets:
        src = item.get("source") or {}
        path = item.get("path") or item.get("href") or "runtime stylesheet"
        diagnostics.append(runtime_diagnostic(
            "error",
            "runtime_surface.missing_stylesheet",
            f"Runtime HTML references missing stylesheet {path}. Quick Runtime Lens needs a full build or a complete out/html checkout.",
            src.get("path"),
            src.get("line"),
            missingPath=path,
        ))
    if missing_scripts or missing_stylesheets:
        missing = [item.get("path") or item.get("src") or item.get("href") for item in missing_scripts + missing_stylesheets]
        diagnostics.append(runtime_diagnostic(
            "warning",
            "runtime_surface.partial_runtime",
            "Generated runtime surface is incomplete; static indexing can continue, but quick preview is not reliable.",
            missingPaths=[item for item in missing if item],
        ))
    return diagnostics


def extract_runtime_surface(root: Path) -> dict[str, Any]:
    html_root = root / RUNTIME_HTML_ROOT
    index_path = root / RUNTIME_INDEX_REL
    if not html_root.exists():
        return {
            "sources": [],
            "scripts": [],
            "stylesheets": [],
            "regions": [],
            "controls": [],
            "cssVariables": [],
            "libraries": [],
            "assetRefs": [],
            "hooks": [],
            "readiness": {
                "status": "unavailable",
                "quickPreviewReady": False,
                "htmlRoot": RUNTIME_HTML_ROOT,
                "reason": "out/html is not present.",
            },
            "diagnostics": [],
            "confidence": CONF_OPAQUE,
        }
    if not index_path.is_file():
        diagnostic = runtime_diagnostic(
            "warning",
            "runtime_surface.missing_index",
            "Generated runtime HTML exists, but out/html/index.html was not found.",
            RUNTIME_INDEX_REL,
        )
        return {
            "sources": [],
            "scripts": [],
            "stylesheets": [],
            "regions": [],
            "controls": [],
            "cssVariables": [],
            "libraries": [],
            "assetRefs": [],
            "hooks": [],
            "readiness": {
                "status": "missing",
                "quickPreviewReady": False,
                "htmlRoot": RUNTIME_HTML_ROOT,
                "reason": "out/html/index.html is missing.",
            },
            "diagnostics": [diagnostic],
            "confidence": CONF_OPAQUE,
        }

    html_text = read_text_prefix(index_path, RUNTIME_FILE_LIMIT)
    parsed = parse_html(root, RUNTIME_INDEX_REL, html_text)
    sources: list[str] = [RUNTIME_INDEX_REL]
    scripts = parsed["scripts"]
    stylesheets = parsed["stylesheets"]
    regions = parsed["regions"]
    controls = parsed["controls"]
    asset_refs = parsed["assetRefs"]
    region_seen = {(item.get("selector", ""), item.get("role", "")) for item in regions}
    asset_seen = {(item.get("path", ""), item.get("role", "")) for item in asset_refs}
    for selector, role, label in RUNTIME_CONVENTION_REGIONS:
        add_region(regions, region_seen, selector, role, label, RUNTIME_INDEX_REL, None, "runtime_convention")
    css_variables: list[dict[str, Any]] = []
    libraries: list[dict[str, Any]] = []
    library_seen: set[str] = set()
    hooks: list[dict[str, Any]] = []

    for script in scripts:
        for library_id, name in libraries_from_ref(script.get("src") or script.get("path") or ""):
            src = script.get("source") or {}
            add_library(libraries, library_seen, library_id, name, src.get("path") or RUNTIME_INDEX_REL, src.get("line"), "script_tag")
    for rel in [item.get("path") for item in stylesheets if item.get("path") and item.get("exists")]:
        path = root / str(rel)
        if not path.is_file():
            continue
        sources.append(str(rel))
        text = read_text_prefix(path, RUNTIME_FILE_LIMIT)
        variables, _asset_refs = extract_css_surface(root, str(rel), text, regions, region_seen, asset_refs, asset_seen)
        css_variables.extend(variables)
    for rel in [item.get("path") for item in scripts if item.get("path") and item.get("exists")]:
        path = root / str(rel)
        if not path.is_file():
            continue
        sources.append(str(rel))
        text = read_text_prefix(path, RUNTIME_FILE_LIMIT)
        hooks.extend(extract_js_surface(root, str(rel), text, regions, region_seen, asset_refs, asset_seen, libraries, library_seen))

    diagnostics = dependency_diagnostics(scripts, stylesheets)
    missing_count = len([item for item in scripts + stylesheets if item.get("external") is False and not item.get("exists")])
    readiness = {
        "status": "partial" if missing_count else "ready",
        "quickPreviewReady": missing_count == 0,
        "htmlRoot": RUNTIME_HTML_ROOT,
        "index": RUNTIME_INDEX_REL,
        "missingDependencyCount": missing_count,
        "scriptCount": len(scripts),
        "stylesheetCount": len(stylesheets),
    }
    if missing_count:
        readiness["reason"] = "Referenced local runtime scripts or stylesheets are missing."
    else:
        readiness["reason"] = "Runtime HTML and referenced local dependencies are present."

    return {
        "sources": sorted(dict.fromkeys(sources)),
        "scripts": scripts,
        "stylesheets": stylesheets,
        "regions": sorted(regions, key=lambda item: (item.get("role", ""), item.get("selector", ""))),
        "controls": sorted(controls, key=lambda item: ((item.get("source") or {}).get("line") or 0, item.get("selector", ""))),
        "cssVariables": css_variables,
        "libraries": sorted(libraries, key=lambda item: item.get("id", "")),
        "assetRefs": sorted(asset_refs, key=lambda item: (item.get("type", ""), item.get("path", ""))),
        "hooks": sorted(hooks, key=lambda item: item.get("name", "")),
        "readiness": readiness,
        "diagnostics": diagnostics,
        "confidence": CONF_STATIC,
    }
