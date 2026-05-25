from .common import *

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


def normalize_asset_directive(value: str) -> str:
    key = re.sub(r"[^A-Za-z0-9]+", "", str(value or "").strip()).lower()
    return {
        "cardimage": "card-image",
        "faceimage": "face-image",
        "setbg": "set-bg",
        "setmusic": "set-music",
        "setsprites": "set-sprites",
        "audio": "audio",
    }.get(key, key)


ASSET_DIRECTIVE_FIELDS = {
    "cardImage": "card-image",
    "faceImage": "face-image",
    "setBg": "set-bg",
    "setMusic": "set-music",
    "setSprites": "set-sprites",
    "audio": "audio",
}


def active_asset_directive_lines(scene: dict[str, Any]) -> set[tuple[int, str]]:
    lines: set[tuple[int, str]] = set()

    def add_from_metadata(item: dict[str, Any]) -> None:
        metadata = item.get("metadata", {}) if isinstance(item, dict) else {}
        if not isinstance(metadata, dict):
            return
        for field, directive in ASSET_DIRECTIVE_FIELDS.items():
            source = metadata.get(field)
            line = source.get("line") if isinstance(source, dict) else None
            if isinstance(line, int) and line > 0:
                lines.add((line, directive))

    add_from_metadata(scene)
    for section in scene.get("sections", []) or []:
        if isinstance(section, dict):
            add_from_metadata(section)
    return lines


AUDIO_MODIFIER_KEYWORDS = frozenset(
    ["loop", "queue", "shuffle", "nofade", "clear", "null", "none"]
)


def parse_audio_modifiers(value: str) -> list[str]:
    tokens = str(value or "").split()
    return [t.lower() for t in tokens if t.lower() in AUDIO_MODIFIER_KEYWORDS]


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


def line_contains_inline_asset_reference(value: str) -> bool:
    text = str(value or "")
    return bool(
        re.search(r"<\s*img\b|src\s*=|href\s*=|url\s*\(|!\[[^\]]*\]\(", text, re.IGNORECASE)
        or re.match(r"^\s*(?:image|img|asset|background|portrait|illustration)\s*:", text, re.IGNORECASE)
    )


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
    active_directive_lines = active_asset_directive_lines(scene)
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return []
    for line_num, line in enumerate(lines, 1):
        match = re.match(r"^\s*(card[-_ ]?image|face[-_ ]?image|set[-_ ]?bg|set[-_ ]?music|set[-_ ]?sprites|audio)\s*:\s*(.+)$", line, re.IGNORECASE)
        directive = normalize_asset_directive(match.group(1)) if match else ""
        reference_text = match.group(2) if match else line
        if not directive and not line_contains_inline_asset_reference(line):
            continue
        audio_modifiers: list[str] = []
        if directive in ("audio", "set-music"):
            audio_modifiers = parse_audio_modifiers(reference_text)
        asset_paths = asset_paths_from_directive(reference_text)
        audio_group_id = ""
        if directive in ("audio", "set-music") and len(asset_paths) > 1:
            audio_group_id = f"audio_group_{line_num}"
        for asset_path in asset_paths:
            asset_type = asset_type_for_extension(Path(asset_path).suffix)
            if not asset_type:
                continue
            role = directive or ("inline-image" if asset_type == "image" else "inline-asset")
            key = (asset_path, role)
            if key in seen:
                continue
            seen.add(key)
            file_exists, preview_url = resolve_asset_reference(root, asset_path)
            source = source_ref(rel, line_num)
            source["rawAnchorText"] = line
            source["rawEndAnchorText"] = line
            source["anchorText"] = line.strip()
            source["endAnchorText"] = line.strip()
            ref: dict[str, Any] = {
                "path": asset_path,
                "name": Path(asset_path).name,
                "label": Path(asset_path).name,
                "type": asset_type,
                "extension": Path(asset_path).suffix.lower(),
                "sourceKind": "source_reference",
                "editability": "reference_only",
                "confidence": CONF_STATIC,
                "source": source,
                "directive": role,
                "fileExists": file_exists,
            }
            if audio_modifiers:
                ref["audioModifiers"] = audio_modifiers
            if audio_group_id:
                ref["audioGroupId"] = audio_group_id
            if directive:
                is_active_directive = (line_num, role) in active_directive_lines
                ref["runtimeActive"] = is_active_directive
                if not is_active_directive:
                    ref["directiveStatus"] = "inert_after_content"
                    ref["confidence"] = CONF_OPAQUE
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
