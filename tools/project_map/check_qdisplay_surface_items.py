#!/usr/bin/env python3
"""R5 detection check: qdisplay band lines become surface-text items.

qdisplay files are simple range→label maps. The surface-text extractor must
emit one item per `(a..b) label` band line — carrying the VERBATIM line as
source.anchorText so the source-slice editor opens with exactly the text the
install apply will match — and must emit nothing for non-band lines. Other
surface sources (scenes, html) keep their existing extractors.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

PROJECT_MAP = Path(__file__).resolve().parent
if str(PROJECT_MAP) not in sys.path:
    sys.path.insert(0, str(PROJECT_MAP))

from indexer.surface_text import extract_qdisplay_band_items, extract_surface_text  # noqa: E402


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def main() -> int:
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        qdisplays = root / "source" / "qdisplays"
        qdisplays.mkdir(parents=True)
        scenes = root / "source" / "scenes"
        scenes.mkdir(parents=True)

        # Mirrors the real corpus: leading blank line, HTML label spans, open
        # range ends, no trailing newline, plus non-band noise lines.
        (qdisplays / "confidence.qdisplay.dry").write_text(
            "\n"
            '(..1) <span style="color: #d42f2f;">lost</span>\n'
            "(1..2) plain waning\n"
            "# not a band line\n"
            "(broken..) missing bounds (..)\n"
            "(5..) <b>unquestioning</b>",
            encoding="utf-8",
        )
        (scenes / "status.scene.dry").write_text(
            "title: Status\n\n標題: 狀態列\n",
            encoding="utf-8",
        )

        variables = [{"name": "confidence", "reads": [], "writes": []}]

        # 1. The band extractor alone: items, line numbers, verbatim anchors.
        text = (qdisplays / "confidence.qdisplay.dry").read_text(encoding="utf-8")
        bands = extract_qdisplay_band_items(
            "source/qdisplays/confidence.qdisplay.dry", text, {"confidence"}
        )
        assert_true(len(bands) == 3, f"expected 3 band items, got {len(bands)}")
        lines = [item["source"]["line"] for item in bands]
        assert_true(lines == [2, 3, 6], f"band line numbers wrong: {lines}")
        first = bands[0]
        assert_true(
            first["source"]["anchorText"] == '(..1) <span style="color: #d42f2f;">lost</span>',
            "anchorText must be the verbatim band line",
        )
        assert_true(first["label"] == "confidence (..1) lost",
                    f"label should strip HTML and prefix the stem: {first['label']!r}")
        assert_true(first["area"] == "qdisplay", "band items keep the qdisplay area")
        assert_true(first["editability"] == "draft_exportable",
                    "band items must stay draft_exportable")
        assert_true(first.get("variableName") == "confidence",
                    "the file stem should attach as variableName when it names a variable")
        open_end = bands[2]
        assert_true(open_end["source"]["line"] == 6 and "unquestioning" in open_end["label"],
                    "open-ended (5..) bands must be recorded")
        assert_true(all("(broken" not in item["label"] and "# not a band" not in item["label"]
                        for item in bands),
                    "non-band lines must emit nothing")

        # 2. The full surface pass: qdisplay items ride index.surfaceText next
        #    to the other extractors' items, deduped and capped as usual.
        surface = extract_surface_text(root, variables)
        q_items = [item for item in surface["items"] if item["area"] == "qdisplay"]
        assert_true(len(q_items) == 3, "the surface pass should carry the 3 band items")
        assert_true(all(item["source"].get("anchorText") for item in q_items),
                    "surface-pass qdisplay items must keep anchorText")
        other_items = [item for item in surface["items"] if item["area"] != "qdisplay"]
        assert_true(any(item["label"] == "標題" for item in other_items),
                    "non-qdisplay surface extraction must keep working")

    print("qdisplay band surface items OK (3 bands, verbatim anchors, no noise)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
