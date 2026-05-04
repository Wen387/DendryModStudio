from .common import *

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
