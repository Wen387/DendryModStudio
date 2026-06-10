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
BRANCH_LAUNCHER = REPO_ROOT / "tools" / "project_map" / "launch_studio_branch.py"
PROJECT_ROOT = REPO_ROOT / "tools" / "project_map" / "templates" / "starter-demo"
PACKAGE_JSON = REPO_ROOT / "package.json"


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        fail(f"could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_launcher():
    return load_module("launch_studio", LAUNCHER)


def check_branch_launcher() -> None:
    bl = load_module("launch_studio_branch", BRANCH_LAUNCHER)

    # Live branch listing should at least surface the current branch as current.
    branches = bl.list_branches()
    assert_true(len(branches) >= 1, "branch launcher should list at least one local branch")
    currents = [b for b in branches if b.is_current]
    assert_true(len(currents) <= 1, "branch launcher should mark at most one current branch")

    # An already-checked-out branch runs in place with no worktree and no symlinks.
    in_place_info = bl.BranchInfo(
        name="codex/DevEnvImprove",
        sha="0" * 40,
        short_sha="0000000",
        date="2026-06-10",
        subject="x",
        checked_out_at=str(REPO_ROOT),
        is_current=True,
    )
    in_place_plan = bl.build_launch_plan(in_place_info)
    assert_true(in_place_plan.in_place is True, "checked-out branch should run in place")
    assert_true(in_place_plan.creates_worktree is False, "checked-out branch should not create a worktree")
    assert_true(in_place_plan.symlinks == [], "primary checkout already has node_modules, no symlinks needed")
    assert_true(in_place_plan.run_path == REPO_ROOT, "in-place run path should be the existing checkout")

    # A branch with no existing checkout goes through an ephemeral temp worktree.
    ephemeral_info = bl.BranchInfo(
        name="feature/some-branch",
        sha="1" * 40,
        short_sha="1111111",
        date="2026-06-10",
        subject="y",
        checked_out_at=None,
        is_current=False,
    )
    eph_plan = bl.build_launch_plan(ephemeral_info)
    assert_true(eph_plan.creates_worktree is True, "uncheckout branch should create a worktree")
    assert_true(eph_plan.in_place is False, "uncheckout branch should not run in place")
    assert_true(str(bl.EPHEMERAL_PARENT) in str(eph_plan.run_path), "ephemeral worktree should live under the temp parent")
    assert_true(len(eph_plan.symlinks) == 2, "ephemeral worktree should borrow root + desktop node_modules by symlink")
    assert_true(eph_plan.start_command[:1] == ["npm"], "branch launch should start via npm")
    assert_true(str(eph_plan.desktop_dir).endswith("tools/project_map/desktop"), "branch launch should target the desktop app dir")

    contract = json.loads(bl.plan_as_json(eph_plan, "plan"))
    assert_true(contract["writesSource"] is False, "branch launch must not write source")
    assert_true(contract["touchesOutHtml"] is False, "branch launch must not touch out/html")
    assert_true(contract["switchesPrimaryBranch"] is False, "branch launch must not switch the primary branch")
    assert_true(contract["ephemeral"] is True, "branch launch plan should report ephemeral worktree use")

    list_result = subprocess.run(
        [sys.executable, str(BRANCH_LAUNCHER), "--list"],
        cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    assert_true(list_result.returncode == 0, "branch launcher --list should exit 0: " + list_result.stderr)
    listed = json.loads(list_result.stdout)
    assert_true(isinstance(listed, list) and len(listed) >= 1, "branch launcher --list should emit a non-empty JSON array")
    assert_true(all("name" in row and "shortSha" in row for row in listed), "each listed branch should carry name + shortSha")

    current_name = next((b.name for b in branches if b.is_current), branches[0].name)
    plan_result = subprocess.run(
        [sys.executable, str(BRANCH_LAUNCHER), "--plan", current_name],
        cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    assert_true(plan_result.returncode == 0, "branch launcher --plan should exit 0: " + plan_result.stderr)
    plan_json = json.loads(plan_result.stdout)
    assert_true(plan_json["branch"] == current_name, "--plan should report the requested branch")
    assert_true(plan_json["switchesPrimaryBranch"] is False, "--plan should affirm it never switches the primary branch")


def main() -> int:
    launcher = load_launcher()

    root = launcher.find_project_root(PROJECT_ROOT)
    assert_true(root == PROJECT_ROOT, "launcher should resolve the starter demo project root")

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
    assert_true(plan.authoring_dir == REPO_ROOT / "tools" / "project_map" / "authoring", "authoring directory should be resolved")
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
            str(PROJECT_ROOT),
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
    assert_true(dry_run["authoringDir"].endswith("tools/project_map/authoring"), "dry-run should report authoring module path")
    assert_true("/index.html?index=/project-index.json" in dry_run["url"], "dry-run URL should include autoload query")
    assert_true(dry_run["assetBaseRoute"] == "/_project_asset", "dry-run should report the read-only asset route")
    assert_true(dry_run["mode"] == "dry-run", "dry-run should report mode")
    assert_true(dry_run["readOnly"] is True, "dry-run should state read-only behavior")

    viewer_app = (REPO_ROOT / "tools" / "project_map" / "viewer" / "app.js").read_text(encoding="utf-8")
    assert_true("loadProjectIndexUrl" in viewer_app, "viewer should support launcher URL autoload")

    package = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    scripts = package.get("scripts") or {}
    assert_true(
        scripts.get("studio:preview")
        == "python3 tools/project_map/launch_studio.py --root tools/project_map/templates/starter-demo",
        "root package should expose the browser preview launcher with a runnable default project",
    )
    assert_true(
        scripts.get("studio:preview:no-open")
        == "python3 tools/project_map/launch_studio.py --root tools/project_map/templates/starter-demo --no-open",
        "root package should expose a no-open browser preview launcher with a runnable default project",
    )
    assert_true(
        scripts.get("studio:preview:plan")
        == "python3 tools/project_map/launch_studio.py --root tools/project_map/templates/starter-demo --dry-run --no-open",
        "root package should expose a dry-run launch plan with a runnable default project",
    )
    assert_true(
        scripts.get("studio:app") == "npm --prefix tools/project_map/desktop run start",
        "root package should expose the desktop app launcher",
    )
    assert_true(
        scripts.get("studio:app:doctor") == "npm --prefix tools/project_map/desktop run doctor",
        "root package should expose the desktop doctor",
    )
    assert_true(
        scripts.get("studio:app:smoke") == "npm --prefix tools/project_map/desktop run smoke",
        "root package should expose the desktop smoke check",
    )
    assert_true(
        scripts.get("studio:branch") == "python3 tools/project_map/launch_studio_branch.py",
        "root package should expose the per-branch desktop app launcher",
    )
    assert_true(
        scripts.get("studio:branch:list") == "python3 tools/project_map/launch_studio_branch.py --list",
        "root package should expose the branch listing shortcut",
    )
    assert_true(
        scripts.get("check:launch") == "python3 tools/project_map/check_launch_studio.py",
        "root package should expose launcher contract checks",
    )

    check_branch_launcher()

    authoring_path = launcher.resolve_authoring_file_path(plan.authoring_dir, "/authoring/news_draft.js")
    assert_true(authoring_path == plan.authoring_dir / "news_draft.js", "launcher should serve viewer authoring modules")
    try:
        launcher.resolve_authoring_file_path(plan.authoring_dir, "/authoring/../launch_studio.py")
    except PermissionError:
        pass
    else:
        fail("launcher should reject authoring module path traversal")

    print(json.dumps({"ok": True, "launcher": str(LAUNCHER)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
