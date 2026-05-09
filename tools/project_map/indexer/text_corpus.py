from .common import *

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


def original_source_text(lines: list[str], start_line: int, end_line: int) -> str:
    if start_line < 1 or end_line < start_line:
        return ""
    start = start_line - 1
    end = min(len(lines), end_line)
    return "\n".join(line.strip() for line in lines[start:end]).strip()


def split_option_title_parts(value: str) -> tuple[str, str]:
    text = compact_visible_text(value)
    if not text:
        return "", ""
    for divider in ("——", " — ", " -- "):
        if divider in text:
            before, after = text.split(divider, 1)
            return compact_visible_text(before), compact_visible_text(after)
    return text, ""


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


def inline_conditional_remainder(value: str) -> str:
    return compact_visible_text(strip_inline_conditionals(value))


def is_mixed_inline_conditional(value: str) -> bool:
    if not extract_inline_conditionals(value):
        return False
    remainder = inline_conditional_remainder(value)
    return bool(remainder and not is_structural_scene_line(remainder))


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
        source_end_line = end_line or line_num
        source = source_range_ref(rel, line_num, source_end_line)
        if 1 <= line_num <= len(lines):
            source["anchorText"] = lines[line_num - 1].strip()
        if 1 <= source_end_line <= len(lines):
            source["endAnchorText"] = lines[source_end_line - 1].strip()
        original = original_source_text(lines, line_num, source_end_line)
        payload: dict[str, Any] = {
            "id": str(extra.get("id")) if extra and extra.get("id") else stable_text_id(rel, line_num, role, value),
            "role": role,
            "text": value,
            "originalText": original or value,
            "owner": {
                "kind": "scene",
                "sceneId": scene.get("id", ""),
                "sectionId": section.get("id", "") if section else "",
                "sceneType": scene.get("type", "scene"),
            },
            "source": source,
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

        heading = re.match(r"^\s*=+\s*(.+?)\s*$", raw)
        if heading:
            flush_paragraph(line_num)
            append_item("heading", heading.group(1), line_num, active_section)
            continue

        option = re.match(r"^\s*-\s+([@#])([A-Za-z0-9_.-]+)(?::\s*(.+?))?\s*$", raw)
        if option:
            flush_paragraph(line_num)
            option_id = option.group(2)
            option_text = compact_visible_text(option.group(3) or "")
            label, subtitle = split_option_title_parts(option_text)
            if label:
                append_item(
                    "option_label",
                    label,
                    line_num,
                    active_section,
                    extra={
                        "id": stable_text_id(rel, line_num, "option_label", option_text),
                        "optionId": option_id
                    }
                )
            if subtitle:
                append_item(
                    "option_subtitle",
                    subtitle,
                    line_num,
                    active_section,
                    extra={"optionId": option_id}
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
            if is_mixed_inline_conditional(stripped):
                append_item(
                    "body",
                    stripped,
                    line_num,
                    active_section,
                    extra={
                        "hasInlineConditionals": True,
                        "inlineConditions": [condition for condition, _text in conditional_items],
                    }
                )
            else:
                for condition, text in conditional_items:
                    append_item("conditional_body", text, line_num, active_section, condition)
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
