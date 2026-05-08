from .common import *


EFFECT_HOOK_RE = re.compile(r"\b(on-arrival|on-display)\s*:\s*(.+)$")
EFFECT_ASSIGNMENT_RE = re.compile(
    r"^\s*(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|/=|=)\s*(.+?)\s*$"
)


def attach_scene_effects(root: Path, scenes: list[dict[str, Any]]) -> None:
    """Attach source-backed simple Dendry effects to normalized scenes.

    Dendry shorthand such as
    `on-arrival: budget += 1; flag_seen = 1 if condition`
    is player-visible authoring logic in Studio, so keep it structured instead
    of leaving it as only variable-write context.
    """
    for scene in scenes:
        scene["effects"] = extract_scene_effects(root, scene)


def extract_scene_effects(root: Path, scene: dict[str, Any]) -> list[dict[str, Any]]:
    rel = scene.get("path")
    if not isinstance(rel, str) or not rel or rel == POST_EVENT_REL or is_generated_artifact(rel):
        return []
    path = root / rel
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return []

    effects: list[dict[str, Any]] = []
    in_magic = False
    for line_num, raw in enumerate(lines, 1):
        stripped = raw.strip()
        if in_magic:
            if "!}" in stripped:
                in_magic = False
            continue
        if "{!" in stripped:
            if "!}" not in stripped:
                in_magic = True
            continue
        match = EFFECT_HOOK_RE.search(stripped)
        if not match:
            continue
        hook = match.group(1)
        body = match.group(2).strip()
        for order, clause in enumerate(split_effect_clauses(body), 1):
            parsed = parse_effect_clause(clause)
            if not parsed:
                continue
            expression = effect_expression(parsed, q_prefix=True)
            source_expression = effect_expression(parsed, q_prefix=False)
            source = source_ref(rel, line_num)
            source.update({
                "startLine": line_num,
                "endLine": line_num,
                "anchorText": stripped,
                "endAnchorText": stripped,
            })
            effects.append({
                "id": stable_effect_id(rel, line_num, hook, order, source_expression),
                "variable": parsed["variable"],
                "op": parsed["op"],
                "operator": parsed["op"],
                "value": parsed["value"],
                "condition": parsed["condition"],
                "hook": hook,
                "syntax": "dendry_shorthand",
                "sourceExpression": source_expression,
                "displayExpression": expression,
                "expression": expression,
                "sourceOrder": order,
                "sectionId": section_id_for_line(scene, line_num),
                "source": source,
                "evidence": "scene_effect",
                "confidence": CONF_STATIC,
            })
    return effects


def split_effect_clauses(value: str) -> list[str]:
    clauses: list[str] = []
    current: list[str] = []
    quote = ""
    escaped = False
    for char in value:
        if escaped:
            current.append(char)
            escaped = False
            continue
        if char == "\\" and quote:
            current.append(char)
            escaped = True
            continue
        if quote:
            current.append(char)
            if char == quote:
                quote = ""
            continue
        if char in {"'", '"'}:
            quote = char
            current.append(char)
            continue
        if char == ";":
            clause = "".join(current).strip()
            if clause:
                clauses.append(clause)
            current = []
            continue
        current.append(char)
    clause = "".join(current).strip()
    if clause:
        clauses.append(clause)
    return clauses


def parse_effect_clause(clause: str) -> dict[str, str] | None:
    expression, condition = split_trailing_if(clause)
    match = EFFECT_ASSIGNMENT_RE.match(expression)
    if not match:
        return None
    return {
        "variable": match.group(1),
        "op": match.group(2),
        "value": match.group(3).strip(),
        "condition": condition,
    }


def split_trailing_if(value: str) -> tuple[str, str]:
    text = value.strip()
    quote = ""
    escaped = False
    split_at = -1
    index = 0
    while index < len(text):
        char = text[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\" and quote:
            escaped = True
            index += 1
            continue
        if quote:
            if char == quote:
                quote = ""
            index += 1
            continue
        if char in {"'", '"'}:
            quote = char
            index += 1
            continue
        if text[index:index + 4].lower() == " if ":
            split_at = index
        index += 1
    if split_at < 0:
        return text, ""
    return text[:split_at].strip(), text[split_at + 4:].strip()


def effect_expression(effect: dict[str, str], q_prefix: bool) -> str:
    prefix = "Q." if q_prefix else ""
    expression = f"{prefix}{effect['variable']} {effect['op']} {effect['value']}".strip()
    condition = effect.get("condition", "")
    if condition:
        expression += f" if {condition}"
    return expression


def section_id_for_line(scene: dict[str, Any], line_num: int) -> str:
    for section in scene.get("sections", []):
        span = section.get("sourceSpan") or {}
        start = span.get("startLine")
        end = span.get("endLine")
        if isinstance(start, int) and isinstance(end, int) and start <= line_num <= end:
            return str(section.get("id") or "")
    return ""


def stable_effect_id(rel: str, line_num: int, hook: str, order: int, expression: str) -> str:
    digest = hashlib.sha1(f"{rel}:{line_num}:{hook}:{order}:{expression}".encode("utf-8")).hexdigest()[:12]
    return f"effect_{digest}"
