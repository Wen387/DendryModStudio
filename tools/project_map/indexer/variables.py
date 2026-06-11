from .common import *

# Bounds for carrying an opaque `{! … !}` block's verbatim source so the object
# editor can offer a guarded in-place raw-JS edit. Small blocks ship their exact
# text (incl. wrapper) and become guard-editable; oversized logic blocks omit it
# and stay IDE-only, which also keeps the index from bloating.
OPAQUE_BLOCK_EDIT_MAX_CHARS = 2000
OPAQUE_BLOCK_EDIT_MAX_LINES = 40


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
        self.dynamic_key_evidence: list[dict[str, Any]] = []
        self.opaque_js_blocks: Counter[str] = Counter()
        self.opaque_js_block_items: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._reported_dynamic: set[tuple[str, int, str]] = set()
        self._reported_dynamic_evidence: set[tuple[str, int, str, str]] = set()

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
                # Blocks-only pass: record `{! … !}` hook block spans (anchors,
                # bounded rawText) WITHOUT variable semantics, so the object
                # editor can offer a raw source-slice entry. The full scan
                # stays skipped — no semantic claims about post_event.
                try:
                    self.iter_js_blocks(rel, path.read_text(encoding="utf-8").splitlines())
                except Exception:
                    pass
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

    def opaque_blocks_by_path(self) -> dict[str, list[dict[str, Any]]]:
        return {
            rel: list(blocks)
            for rel, blocks in sorted(self.opaque_js_block_items.items())
        }

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

    @staticmethod
    def binding_sources_for_expr(expr: str, bindings: dict[str, list[str]]) -> list[dict[str, Any]]:
        out = []
        seen: set[str] = set()
        without_literals = re.sub(r"'[^']*'|\"[^\"]*\"", "", expr)
        for match in re.finditer(r"\b(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\b", without_literals):
            name = match.group(1)
            if name in {"Q", "true", "false", "null", "undefined"} or name in seen:
                continue
            seen.add(name)
            values = bindings.get(name)
            out.append({
                "name": name,
                "kind": "known_array" if values else "unresolved_identifier",
                "valueCount": len(values) if values else 0,
                "sampleValues": values[:8] if values else [],
            })
        return out

    def add_dynamic_key_evidence(self, rel: str, line: int, expr: str,
                                 bindings: dict[str, list[str]], access_kind: str,
                                 op: str = "", expanded_keys: list[str] | None = None,
                                 manual: bool = False) -> None:
        key = (rel, line, expr, access_kind)
        if key in self._reported_dynamic_evidence:
            return
        self._reported_dynamic_evidence.add(key)
        safe_expansion = bool(expanded_keys) and not manual
        evidence_id = "dynamic_q_" + hashlib.sha1(
            f"{rel}:{line}:{access_kind}:{op}:{expr}".encode("utf-8")
        ).hexdigest()[:12]
        self.dynamic_key_evidence.append({
            "id": evidence_id,
            "expression": expr,
            "accessKind": access_kind,
            "operator": op,
            "classification": self.classify_dynamic_expr(expr),
            "source": source_ref(rel, line),
            "safeExpansion": safe_expansion,
            "expandedKeys": expanded_keys or [],
            "expandedKeyCount": len(expanded_keys or []),
            "bindingSources": self.binding_sources_for_expr(expr, bindings),
            "affectedVariables": expanded_keys or [],
            "reviewBoundary": "guarded_candidate" if safe_expansion else "manual_review",
            "installSafety": "guarded_candidate" if safe_expansion else "manual_review",
            "reason": (
                "Dynamic Q[] key was expanded from bounded local/static bindings."
                if safe_expansion
                else "Dynamic Q[] key could not be proven as a bounded static expansion."
            ),
            "confidence": CONF_STATIC if safe_expansion else CONF_OPAQUE,
        })

    def report_dynamic_uncertainty(self, rel: str, line: int, expr: str,
                                   bindings: dict[str, list[str]], access_kind: str,
                                   op: str = "") -> None:
        key = (rel, line, expr)
        if key in self._reported_dynamic:
            return
        self._reported_dynamic.add(key)
        classification = self.classify_dynamic_expr(expr)
        evidence_id = "dynamic_q_" + hashlib.sha1(
            f"{rel}:{line}:{access_kind}:{op}:{expr}".encode("utf-8")
        ).hexdigest()[:12]
        self.add_dynamic_key_evidence(rel, line, expr, bindings, access_kind, op, [], manual=True)
        self.diagnostics.append({
            "severity": "info",
            "code": "project_map.dynamic_q_opaque",
            "message": f"Dynamic Q[] key could not be statically expanded: Q[{expr}]",
            "path": rel,
            "source": source_ref(rel, line),
            "dynamicKeyEvidenceId": evidence_id,
            "expression": expr,
            "classification": classification,
            "reviewBoundary": "manual_review",
            "safeExpansion": False,
            "confidence": CONF_OPAQUE,
        })

    @staticmethod
    def classify_dynamic_expr(expr: str) -> str:
        text = expr.strip()
        if re.search(r"\[[^\]]+\]", text):
            return "indexed_binding"
        if "+" in text:
            return "dynamic_concatenation"
        if re.match(r"^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*$", text):
            return "unresolved_identifier"
        return "opaque_expression"

    def iter_js_blocks(self, rel: str, lines: list[str]) -> list[list[tuple[int, str]]]:
        blocks: list[list[tuple[int, str]]] = []
        in_block = False
        current: list[tuple[int, str]] = []
        for line_num, line in enumerate(lines, 1):
            if not in_block:
                if re.search(r"\b(on-arrival|on-departure|on-display)\s*:\s*\{!", line, re.I):
                    in_block = True
                    current = [(line_num, line)]
                    self.opaque_js_blocks[rel] += 1
                    if "!}" in line:
                        blocks.append(current)
                        self.record_opaque_js_block(rel, current)
                        current = []
                        in_block = False
                continue
            current.append((line_num, line))
            if "!}" in line:
                blocks.append(current)
                self.record_opaque_js_block(rel, current)
                current = []
                in_block = False
        if current:
            blocks.append(current)
            self.record_opaque_js_block(rel, current)
        return blocks

    def record_opaque_js_block(self, rel: str, block: list[tuple[int, str]]) -> None:
        if not block:
            return
        start_line = block[0][0]
        end_line = block[-1][0]
        lines = [content for _, content in block]
        raw = "\n".join(lines)
        hook_match = re.search(r"\b(on-arrival|on-departure|on-display)\s*:\s*\{!", lines[0], re.I)
        hook = hook_match.group(1).lower() if hook_match else ""
        reads, writes, dynamic_writes = self.variable_names_in_js_block(block)
        source = source_range_ref(rel, start_line, end_line)
        source.update({
            "rawAnchorText": lines[0],
            "rawEndAnchorText": lines[-1],
            "anchorText": lines[0].strip(),
            "endAnchorText": lines[-1].strip(),
        })
        block_id = hashlib.sha1(f"{rel}:{start_line}:{end_line}:{raw[:120]}".encode("utf-8")).hexdigest()[:12]
        item = {
            "id": f"opaque_js_{block_id}",
            "hook": hook,
            "scriptKind": "opaque_js",
            "label": f"{hook or 'script'} JS block",
            "lineCount": max(1, end_line - start_line + 1),
            "rawPreview": self.compact_js_preview(lines),
            "reads": reads,
            "writes": writes,
            "dynamicKeyWrites": dynamic_writes,
            "source": source,
            "reviewBoundary": "manual_review",
            "confidence": CONF_OPAQUE,
        }
        # Verbatim block text (incl. the `hook: {! … !}` wrapper) drives the object
        # editor's guarded raw-JS edit: replace_section over the recorded span uses
        # this as the editable value. rawPreview is reformatted+truncated and must
        # NOT be edited. Bounded so oversized blocks stay IDE-only (no rawText ->
        # model marks them ide_escape_hatch) and the index does not bloat.
        if len(raw) <= OPAQUE_BLOCK_EDIT_MAX_CHARS and len(lines) <= OPAQUE_BLOCK_EDIT_MAX_LINES:
            item["rawText"] = raw
        self.opaque_js_block_items[rel].append(item)

    def variable_names_in_js_block(self, block: list[tuple[int, str]]) -> tuple[list[str], list[str], list[str]]:
        reads: set[str] = set()
        writes: set[str] = set()
        dynamic_writes: set[str] = set()
        for _line_num, raw in block:
            line = self.strip_line_comment(raw)
            for match in self.DOT_WRITE_RE.finditer(line):
                writes.add(match.group(1))
            for match in self.DOT_ACCESS_RE.finditer(line):
                reads.add(match.group(1))
            for match in self.DYN_WRITE_RE.finditer(line):
                dynamic_writes.add(match.group(1).strip())
        return sorted(reads), sorted(writes), sorted(dynamic_writes)

    @staticmethod
    def compact_js_preview(lines: list[str]) -> str:
        body = "\n".join(line.strip() for line in lines)
        body = re.sub(r"^\s*(?:on-arrival|on-departure|on-display)\s*:\s*\{!\s*", "", body, flags=re.I)
        body = re.sub(r"\s*!\}\s*$", "", body)
        body = body.strip()
        if len(body) > 1200:
            return body[:1200].rstrip() + "\n..."
        return body

    def scan_lines(self, rel: str, lines: list[str]) -> None:
        for line_num, line in enumerate(lines, 1):
            condition_match = re.match(r"^\s*(view[-_ ]?if|choose[-_ ]?if)\s*:\s*(.+)$", line, re.I)
            if condition_match:
                self.extract_vars_from_condition(condition_match.group(2), rel, line_num)
            for match in re.finditer(r"\[\?\s*if\s+([^:?]+)", line):
                self.extract_vars_from_condition(match.group(1), rel, line_num)
            if re.search(r"\bgo[-_ ]?to\s*:", line, re.I) and re.search(r"\s+if\s+", line, re.I):
                for condition in re.findall(r"\s+if\s+([^;]+)", line, re.I):
                    self.extract_vars_from_condition(condition, rel, line_num)
            for match in re.finditer(r"\[\+\s*([A-Za-z_][A-Za-z0-9_]*)\b", line):
                self.record_read(match.group(1), rel, line_num)
            hook_match = re.search(r"\b(on-arrival|on-departure|on-display)\s*:\s*(.+)$", line, re.I)
            if hook_match and "{!" not in line:
                self.scan_shorthand_hook(rel, line_num, hook_match.group(2))

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

    def scan_shorthand_hook(self, rel: str, line_num: int, raw: str) -> None:
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
                    self.report_dynamic_uncertainty(rel, line_num, expr, bindings, "write", op)
                    continue
                self.add_dynamic_key_evidence(rel, line_num, expr, bindings, "write", op, names)
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
                    self.report_dynamic_uncertainty(rel, line_num, expr, bindings, "read")
                    continue
                self.add_dynamic_key_evidence(rel, line_num, expr, bindings, "read", "", names)
                for name in names:
                    self.record_read(name, rel, line_num)
