#!/usr/bin/env python3
"""P0 detection check: indexer template-ownership evidence for the System UI
right-sidebar guarded auto-apply.

Verifies extract_template_source() distinguishes no-template / engine-default
from a mod-owned templates/html/<slug>/+index.html, and that anchor /
right-panel detection is quote-tolerant and prefix-safe (stats_sidebar must not
be confused with stats_sidebar_right).
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

PROJECT_MAP = Path(__file__).resolve().parent
if str(PROJECT_MAP) not in sys.path:
    sys.path.insert(0, str(PROJECT_MAP))

from indexer.runtime_surface import extract_template_source  # noqa: E402


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def write_template(root: Path, body: str) -> None:
    tdir = root / "templates" / "html" / "demo-mod"
    tdir.mkdir(parents=True, exist_ok=True)
    (tdir / "+index.html").write_text(body, encoding="utf-8")
    (tdir / "+game.css").write_text(".tools.right{}\n", encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)

        # 1. No templates/html at all -> not owned, opaque confidence.
        none = extract_template_source(root)
        assert_true(none["owned"] is False, "no template dir should report owned=False")
        assert_true(none["dirs"] == [], "no template dir should report empty dirs")
        assert_true(none["confidence"] == "opaque", "no template dir should be opaque")

        # 2. Mod owns a template with the #stats_sidebar anchor, no right panel.
        write_template(
            root,
            "<div id='tools_wrapper'>\n"
            "  <div id='stats_sidebar' class='tools left'></div>\n"
            "  <div id='content'></div>\n"
            "</div>\n",
        )
        owned = extract_template_source(root)
        assert_true(owned["owned"] is True, "an ejected +index.html should report owned=True")
        assert_true(owned["dirs"] == ["templates/html/demo-mod"], "owned dirs should list the template directory")
        assert_true(owned["indexPath"] == "templates/html/demo-mod/+index.html", "indexPath should point at +index.html")
        assert_true(owned["cssPath"] == "templates/html/demo-mod/+game.css", "cssPath should point at +game.css")
        assert_true(owned["hasStatsSidebarAnchor"] is True, "the #stats_sidebar anchor should be detected")
        assert_true(owned["hasRightPanel"] is False, "no right panel should be detected yet")
        assert_true(owned["confidence"] == "exact", "an owned template should be exact confidence")

        # 3. Right panel already present (double-quoted) -> both flags true, and
        #    stats_sidebar detection must not be fooled by stats_sidebar_right.
        write_template(
            root,
            '<div id="stats_sidebar" class="tools left"></div>\n'
            '<div id="stats_sidebar_right" class="tools right"></div>\n',
        )
        ready = extract_template_source(root)
        assert_true(ready["hasStatsSidebarAnchor"] is True, "double-quoted #stats_sidebar should be detected")
        assert_true(ready["hasRightPanel"] is True, "an existing #stats_sidebar_right panel should be detected")

        # 4. Prefix-safety: only the right panel id present must NOT report the
        #    left-sidebar anchor.
        write_template(root, '<div id="stats_sidebar_right" class="tools right"></div>\n')
        right_only = extract_template_source(root)
        assert_true(right_only["hasRightPanel"] is True, "right panel id should be detected")
        assert_true(
            right_only["hasStatsSidebarAnchor"] is False,
            "stats_sidebar_right must not be misread as the stats_sidebar anchor",
        )

    print("OK: template_source_detection")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
