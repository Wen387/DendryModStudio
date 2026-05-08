from .common import *

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
        for statement in raw.split(";"):
            condition_match = re.search(r"\bif\s+(.+)$", statement)
            if condition_match:
                self.extract_vars_from_condition(condition_match.group(1), rel, line_num)
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
