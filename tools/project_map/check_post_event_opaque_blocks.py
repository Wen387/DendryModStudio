#!/usr/bin/env python3
"""R4 detection check: post_event blocks-only indexing.

post_event.scene.dry is intentionally opaque — the variable scanner must keep
skipping its semantics — but the object editor needs the `{! … !}` hook block
SPANS (anchors, bounded rawText) so over-cap blocks can offer a raw Source
Slice entry. Verifies the blocks-only pass records block items with anchors,
keeps oversized blocks rawText-less, records NO variable semantics from
post_event content, and still emits the opaque diagnostic.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

PROJECT_MAP = Path(__file__).resolve().parent
if str(PROJECT_MAP) not in sys.path:
    sys.path.insert(0, str(PROJECT_MAP))

from indexer.common import POST_EVENT_REL  # noqa: E402
from indexer.variables import VariableScanner  # noqa: E402


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def main() -> int:
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        scenes = root / "source" / "scenes"
        scenes.mkdir(parents=True)

        big_body = "\n".join(
            f"    Q.post_event_only_marker_{i} = (Q.post_event_only_marker_{i} || 0) + 1;"
            for i in range(60)
        )
        (scenes / "post_event.scene.dry").write_text(
            "title: Post Event\n"
            "new-page: true\n"
            "on-arrival: {!\n"
            f"{big_body}\n"
            "!}\n"
            "on-display: {!\n"
            "    Q.small_post_event_marker = 1;\n"
            "!}\n",
            encoding="utf-8",
        )
        (scenes / "normal.scene.dry").write_text(
            "title: Normal\n"
            "on-arrival: {!\n"
            "    Q.normal_marker = 1;\n"
            "!}\n",
            encoding="utf-8",
        )

        scanner = VariableScanner(root)
        variables, diagnostics, summary = scanner.scan()
        blocks_by_path = scanner.opaque_blocks_by_path()

        # 1. Block items exist for post_event with full anchor spans.
        pe_blocks = blocks_by_path.get(POST_EVENT_REL, [])
        assert_true(len(pe_blocks) == 2, "post_event should record both hook blocks (blocks-only pass)")
        big = next((b for b in pe_blocks if b["hook"] == "on-arrival"), None)
        small = next((b for b in pe_blocks if b["hook"] == "on-display"), None)
        assert_true(big is not None and small is not None, "both post_event hooks should be recorded")
        for block in (big, small):
            source = block["source"]
            assert_true(bool(source.get("anchorText")) and bool(source.get("endAnchorText")),
                        "post_event blocks must carry start/end anchors")
            assert_true(int(source.get("endLine", 0)) > int(source.get("line", 0)),
                        "post_event blocks must carry a line span")

        # 2. The edit-bound still decides rawText: oversized stays IDE-only.
        assert_true("rawText" not in big, "an over-cap post_event block must stay rawText-less")
        assert_true(big["lineCount"] > 40, "the fixture big block should exceed the line bound")
        assert_true("rawText" in small, "a small post_event block keeps bounded rawText")

        # 3. Variable semantics from post_event stay un-indexed.
        names = {record["name"] for record in variables}
        assert_true("normal_marker" in names, "the control scene's variables should index normally")
        assert_true(not any(name.startswith("post_event_only_marker") for name in names),
                    "post_event JS must not feed the variables table")
        assert_true("small_post_event_marker" not in names,
                    "post_event JS must not feed the variables table (small block)")

        # 4. The opaque diagnostic survives, and the block counter is truthful.
        assert_true(any(d.get("code") == "project_map.post_event_opaque" for d in diagnostics),
                    "the post_event opaque diagnostic must still be emitted")
        assert_true(summary["opaqueJsBlocksByPath"].get(POST_EVENT_REL) == 2,
                    "the block counter should include the post_event blocks")

    print("post_event blocks-only indexing OK (2 blocks, anchors, no variable bleed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
