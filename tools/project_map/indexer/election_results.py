from .common import *


PARTY_COLOR_BY_ID = {
    "spd": "#E3000F",
    "kpd": "#700000",
    "sapd": "#9B0000",
    "kpo": "#C43988",
    "ddp": "#D3C24D",
    "lvp": "#FFCC00",
    "z": "#000000",
    "bvp": "#A2D8E0",
    "dvp": "#D5AC27",
    "dnvp": "#3E88B3",
    "nsdap": "#7A3C00",
    "dnf": "#003755",
    "dnef": "#BFC8CC",
    "nvf": "#5F7278",
    "kvp": "#0087DC",
    "fkp": "#00C0FF",
    "farm": "#7FCEB1",
    "farm3": "#7FCEB1",
    "wp": "#B8996F",
    "other": "#A0A0A0",
    "others": "#A0A0A0",
}

ELECTION_SOURCE_LIMIT = 2_000_000
ELECTION_EVIDENCE_RE = re.compile(
    r"\b(election|elections|wahl|landtag|reichstag|parliament|seat chart|results)\b",
    re.IGNORECASE,
)
D3_EVIDENCE_RE = re.compile(r"\bd3\.parliament\b|d3\.select\(\s*['\"]#|<svg[^>]+id=['\"]", re.IGNORECASE)


def extract_election_results(root: Path, scenes: list[dict[str, Any]]) -> dict[str, Any]:
    """Extract project-specific D3 election-result renderers from full source.

    Scene excerpts are deliberately small, so selector metadata for real Dynamic
    projects has to come from the source file rather than the short review spans.
    """

    items: list[dict[str, Any]] = []
    sources: set[str] = set()
    for scene in scenes:
        path = str(scene.get("path", "")).replace("\\", "/")
        if not path.endswith(".scene.dry") or is_generated_artifact(path):
            continue
        source_path = root / path
        if not source_path.is_file():
            continue
        try:
            text = read_text_prefix(source_path, ELECTION_SOURCE_LIMIT)
        except OSError:
            continue
        if not is_election_results_source(scene, path, text):
            continue

        parties = extract_d3_parties(text, path)
        chart_id = infer_chart_element_id(text)
        uses_d3 = bool(re.search(r"\bd3\.parliament\b", text, re.IGNORECASE))
        if not parties and not chart_id and not uses_d3:
            continue

        source_line = election_source_line(text, chart_id)
        title = str(scene.get("title") or scene.get("name") or scene.get("id") or Path(path).stem)
        item = {
            "id": str(scene.get("id") or safe_id(Path(path).stem)),
            "sceneId": str(scene.get("id") or ""),
            "title": compact_line(title),
            "subtitle": infer_election_subtitle(title, path, text),
            "path": path,
            "line": source_line,
            "electionKind": infer_election_kind(title, path, text),
            "year": infer_year(title + " " + path),
            "month": "",
            "viewIf": metadata_line(scene, "viewIf") or metadata_line(scene, "requires"),
            "conditionText": infer_condition_text(text),
            "chartElementId": chart_id,
            "usesD3Parliament": uses_d3,
            "seatsTotal": infer_seats_total(text, parties),
            "parties": parties,
            "reason": "d3_parliament" if uses_d3 else "election_results_source",
            "confidence": CONF_STATIC,
        }
        sources.add(path)
        items.append(item)

    items.sort(key=lambda item: (0 if item.get("usesD3Parliament") else 1, item.get("path", ""), item.get("id", "")))
    return {
        "items": items,
        "sources": sorted(sources),
        "confidence": CONF_STATIC if items else CONF_PROFILE,
    }


def is_election_results_source(scene: dict[str, Any], path: str, text: str) -> bool:
    if not D3_EVIDENCE_RE.search(text):
        return False
    haystack = " ".join([
        path,
        str(scene.get("id", "")),
        str(scene.get("title", "")),
        str(scene.get("name", "")),
        text[:12000],
    ])
    return bool(ELECTION_EVIDENCE_RE.search(haystack))


def extract_d3_parties(text: str, path: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for block, start in iter_js_object_blocks_with_id(text):
        if not re.search(r"['\"]?seats['\"]?\s*:", block):
            continue
        party_id = js_string_property(block, "id")
        if not party_id:
            continue
        legend = js_label_property(block, "legend", party_id)
        name = js_label_property(block, "name", party_id) or legend
        seats_expression = js_expression_property(block, "seats")
        rows.append({
            "key": safe_id(party_id).lower(),
            "name": compact_line(name or party_id.upper()),
            "color": color_for_party_id(party_id),
            "voteShare": "",
            "voteChange": "0",
            "seatsShare": "",
            "seatsChange": "0",
            "seats": numeric_preview_seats(seats_expression),
            "seatsExpression": compact_line(seats_expression),
            "source": source_ref(path, line_for_offset(text, start)),
        })
    return rows[:48]


def iter_js_object_blocks_with_id(text: str) -> list[tuple[str, int]]:
    rows: list[tuple[str, int]] = []
    for match in re.finditer(r"\{\s*['\"]?id['\"]?\s*:", text):
        start = match.start()
        end = find_matching_brace(text, start, max_chars=4000)
        if end > start:
            rows.append((text[start:end + 1], start))
    return rows


def find_matching_brace(text: str, start: int, max_chars: int) -> int:
    depth = 0
    quote = ""
    escaped = False
    limit = min(len(text), start + max_chars)
    for index in range(start, limit):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in {"'", '"'}:
            quote = char
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def js_string_property(block: str, prop: str) -> str:
    pattern = re.compile(r"['\"]?" + re.escape(prop) + r"['\"]?\s*:\s*(['\"])(.*?)\1", re.DOTALL)
    match = pattern.search(block)
    return compact_line(match.group(2)) if match else ""


def js_label_property(block: str, prop: str, party_id: str) -> str:
    value = js_string_property(block, prop)
    if value:
        return value
    expression = js_expression_property(block, prop)
    if not expression or re.search(r"\bQ\.", expression):
        return party_id.upper()
    return compact_line(expression).strip("'\"") or party_id.upper()


def js_expression_property(block: str, prop: str) -> str:
    pattern = re.compile(r"^\s*['\"]?" + re.escape(prop) + r"['\"]?\s*:\s*(.+?)(?:,\s*)?$", re.MULTILINE)
    match = pattern.search(block)
    return match.group(1).strip() if match else ""


def infer_chart_element_id(text: str) -> str:
    d3 = re.search(r"d3\.select\(\s*['\"]#([^'\"]+)['\"]\s*\)", text)
    if d3:
        return d3.group(1)
    svg = re.search(r"<svg[^>]+id=['\"]([^'\"]+)['\"]", text, re.IGNORECASE)
    return svg.group(1) if svg else ""


def infer_seats_total(text: str, parties: list[dict[str, Any]]) -> str:
    for party in parties:
        expression = str(party.get("seatsExpression", ""))
        number = numeric_seat_total_from_expression(text, expression)
        if number:
            return str(number)
    return ""


def numeric_seat_total_from_expression(text: str, expression: str) -> int | None:
    static = re.search(r"\*\s*(\d+(?:\.\d+)?)", expression)
    if static:
        value = float(static.group(1))
        return round(value * 100) if value < 10 else round(value)
    q_var = re.search(r"\*\s*Q\.([A-Za-z_][A-Za-z0-9_]*)", expression)
    if q_var:
        assign = re.search(r"Q\." + re.escape(q_var.group(1)) + r"\s*=\s*(\d+(?:\.\d+)?)", text)
        if assign:
            value = float(assign.group(1))
            return round(value * 100) if value < 10 else round(value)
    return None


def numeric_preview_seats(expression: str) -> str:
    direct = re.fullmatch(r"\d+(?:\.\d+)?", str(expression or "").strip())
    if direct:
        return direct.group(0)
    return "1" if expression else "0"


def election_source_line(text: str, chart_id: str) -> int:
    needles = []
    if chart_id:
        needles.append(f'#{chart_id}')
        needles.append(f'id="{chart_id}"')
        needles.append(f"id='{chart_id}'")
    needles.extend(["d3.parliament", "d3.select"])
    for needle in needles:
        index = text.find(needle)
        if index >= 0:
            return line_for_offset(text, index)
    return 1


def line_for_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, max(0, offset)) + 1


def color_for_party_id(party_id: str) -> str:
    key = safe_id(party_id).lower()
    return PARTY_COLOR_BY_ID.get(key, PARTY_COLOR_BY_ID.get(key.rstrip("0123456789"), "#999999"))


def infer_election_kind(title: str, path: str, text: str) -> str:
    source = " ".join([title, path, text[:8000]]).lower()
    if re.search(r"landtag|thuringia|prussia|state", source):
        return "state"
    if re.search(r"reichstag|parliament", source):
        return "reichstag"
    return "election"


def infer_election_subtitle(title: str, path: str, text: str) -> str:
    kind = infer_election_kind(title, path, text)
    if kind == "state":
        match = re.search(r"(Thuringia|Prussia|Bavaria|Saxony|Hesse|Hamburg|Berlin)", title + " " + path, re.IGNORECASE)
        return (match.group(1) + " election results") if match else "State election results"
    if kind == "reichstag":
        return "Reichstag election results"
    return "Election results"


def infer_year(text: str) -> str:
    match = re.search(r"\b(19|20)\d{2}\b", text)
    return match.group(0) if match else ""


def infer_condition_text(text: str) -> str:
    match = re.search(r"\[\?\s*if\s+([^:\]]+)", text, re.IGNORECASE)
    return compact_line(match.group(1)) if match else ""


def metadata_line(scene: dict[str, Any], key: str) -> str:
    metadata = scene.get("metadata", {})
    if not isinstance(metadata, dict):
        return ""
    value = metadata.get(key) or metadata.get(re.sub(r"([A-Z])", lambda m: "-" + m.group(1).lower(), key))
    if not isinstance(value, dict):
        return ""
    return compact_line(str(value.get("value") or value.get("raw") or value.get("excerpt") or ""))


def safe_id(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_]+", "_", str(value or "").strip()).strip("_")
    if not text:
        return "item_1"
    return text if re.match(r"^[A-Za-z_]", text) else "item_" + text


def compact_line(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()
