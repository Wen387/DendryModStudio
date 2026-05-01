#!/usr/bin/env python3
"""Smoke checks for the Dendry Mod Studio local launcher."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = REPO_ROOT / "tools" / "project_map" / "launch_studio.py"


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def load_launcher():
    spec = importlib.util.spec_from_file_location("launch_studio", LAUNCHER)
    if spec is None or spec.loader is None:
        fail("could not load launch_studio.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    launcher = load_launcher()

    root = launcher.find_project_root(REPO_ROOT)
    assert_true(root == REPO_ROOT, "launcher should resolve this repo root")

    plan = launcher.build_launch_plan(
        root=root,
        out_dir=Path("/tmp/dendry_project_map"),
        include_excerpts=False,
        excerpt_context_lines=1,
        host="127.0.0.1",
        preferred_port=0,
        open_browser=False,
        probe_port=False,
    )
    assert_true(plan.index_path == Path("/tmp/dendry_project_map/project-index.json"), "default index path should be in /tmp")
    assert_true(plan.viewer_dir == REPO_ROOT / "tools" / "project_map" / "viewer", "viewer directory should be resolved")
    assert_true("127.0.0.1" in plan.url, "launcher URL should use the requested host")
    assert_true("?index=/project-index.json" in plan.url, "launcher URL should auto-load the generated index")
    assert_true("assetBase=/_project_asset" in plan.url, "launcher URL should pass the read-only project asset route")
    assert_true(plan.asset_base_route == "/_project_asset", "launcher should expose the project asset route in the plan")
    assert_true("out/html" not in plan.index_path.as_posix(), "launcher must not write under out/html")
    assert_true(plan.index_args[-1] == "--summary", "launcher should request a summary from the indexer")

    excerpt_plan = launcher.build_launch_plan(
        root=root,
        out_dir=Path("/tmp/dendry_project_map"),
        include_excerpts=True,
        excerpt_context_lines=2,
        host="127.0.0.1",
        preferred_port=0,
        open_browser=False,
        probe_port=False,
    )
    assert_true(
        excerpt_plan.index_path == Path("/tmp/dendry_project_map/project-index-excerpts.json"),
        "excerpt index path should be explicit",
    )
    assert_true("--include-excerpts" in excerpt_plan.index_args, "excerpt plan should pass --include-excerpts")
    assert_true("2" in excerpt_plan.index_args, "excerpt plan should pass context line count")

    chosen_port = launcher.choose_port(
        "127.0.0.1",
        8765,
        can_bind_fn=lambda _host, _port: False,
        any_port_fn=lambda _host: 19001,
    )
    assert_true(chosen_port == 19001, "occupied preferred port should be skipped")

    result = subprocess.run(
        [
            sys.executable,
            str(LAUNCHER),
            "--root",
            str(REPO_ROOT),
            "--dry-run",
            "--no-open",
            "--port",
            "0",
        ],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    assert_true(result.returncode == 0, "dry-run launcher should exit 0: " + result.stderr)
    dry_run = json.loads(result.stdout)
    assert_true(dry_run["indexPath"] == "/tmp/dendry_project_map/project-index.json", "dry-run should report default index path")
    assert_true("/index.html?index=/project-index.json" in dry_run["url"], "dry-run URL should include autoload query")
    assert_true(dry_run["assetBaseRoute"] == "/_project_asset", "dry-run should report the read-only asset route")
    assert_true(dry_run["mode"] == "dry-run", "dry-run should report mode")
    assert_true(dry_run["readOnly"] is True, "dry-run should state read-only behavior")

    viewer_app = (REPO_ROOT / "tools" / "project_map" / "viewer" / "app.js").read_text(encoding="utf-8")
    assert_true("loadProjectIndexUrl" in viewer_app, "viewer should support launcher URL autoload")

    print(json.dumps({"ok": True, "launcher": str(LAUNCHER)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
