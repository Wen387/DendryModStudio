#!/usr/bin/env python3
"""Launch the Dendry Mod Studio desktop app for any local branch.

This is a developer convenience entry point. It lists every local git branch,
lets you pick one, and runs that branch's *latest* desktop app without
disturbing the checkout you are currently editing.

How it stays non-destructive:

- The branch you currently have checked out (and any branch already living in a
  git worktree) runs in place from that existing path.
- Every other branch is run from a throwaway *ephemeral* git worktree created
  under the system temp dir at the branch tip; it is removed again as soon as
  the app exits.
- The desktop app has no runtime npm dependencies of its own (only electron, a
  devDependency), so each worktree borrows the primary checkout's node_modules
  through a symlink instead of a multi-hundred-megabyte reinstall. Only symlinks
  and worktrees this launcher created are ever cleaned up.

It never edits source, never touches out/html, and never switches the branch of
your primary checkout.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NamedTuple


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DESKTOP_REL = Path("tools/project_map/desktop")
# node_modules trees the desktop app may resolve against, borrowed by symlink.
NODE_MODULES_RELS = (Path("node_modules"), DESKTOP_REL / "node_modules")
EPHEMERAL_PARENT = Path(tempfile.gettempdir()) / "dendry_studio_branches"


class BranchInfo(NamedTuple):
    name: str
    sha: str
    short_sha: str
    date: str
    subject: str
    checked_out_at: str | None  # existing worktree path, or None
    is_current: bool


class LaunchPlan(NamedTuple):
    branch: str
    short_sha: str
    run_path: Path
    desktop_dir: Path
    start_command: list[str]
    creates_worktree: bool
    symlinks: list[Path]  # symlinks this launcher would create
    in_place: bool        # runs from an existing checkout (current or worktree)


def git(args: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd or REPO_ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def current_branch() -> str | None:
    name = git(["rev-parse", "--abbrev-ref", "HEAD"]).strip()
    return None if name == "HEAD" else name


def worktree_branches() -> dict[str, str]:
    """Map branch name -> worktree path for branches already checked out."""
    mapping: dict[str, str] = {}
    path: str | None = None
    for line in git(["worktree", "list", "--porcelain"]).splitlines():
        if line.startswith("worktree "):
            path = line[len("worktree "):].strip()
        elif line.startswith("branch "):
            ref = line[len("branch "):].strip()
            short = ref[len("refs/heads/"):] if ref.startswith("refs/heads/") else ref
            if path:
                mapping[short] = path
    return mapping


def list_branches() -> list[BranchInfo]:
    cur = current_branch()
    wt = worktree_branches()
    fmt = "%(refname:short)%09%(objectname)%09%(objectname:short)%09%(committerdate:short)%09%(contents:subject)"
    rows: list[BranchInfo] = []
    for line in git(["for-each-ref", "--sort=-committerdate", f"--format={fmt}", "refs/heads"]).splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        while len(parts) < 5:
            parts.append("")
        name, sha, short_sha, date, subject = parts[:5]
        rows.append(BranchInfo(
            name=name,
            sha=sha,
            short_sha=short_sha,
            date=date,
            subject=subject,
            checked_out_at=wt.get(name),
            is_current=(name == cur),
        ))
    return rows


def find_branch(branches: list[BranchInfo], name: str) -> BranchInfo:
    for b in branches:
        if b.name == name:
            return b
    raise ValueError(f"No local branch named '{name}'. Try --list.")


def slugify(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name).strip("-") or "branch"


def build_launch_plan(branch_info: BranchInfo) -> LaunchPlan:
    if branch_info.checked_out_at:
        run_path = Path(branch_info.checked_out_at).resolve()
        creates_worktree = False
        in_place = True
    else:
        run_path = (EPHEMERAL_PARENT / f"{slugify(branch_info.name)}-{branch_info.short_sha}").resolve()
        creates_worktree = True
        in_place = False

    desktop_dir = run_path / DESKTOP_REL
    # Symlinks we would need to add for node_modules the run path does not have.
    symlinks: list[Path] = []
    for rel in NODE_MODULES_RELS:
        if not (run_path / rel).exists():
            symlinks.append(run_path / rel)

    start_command = ["npm", "--prefix", str(desktop_dir), "run", "start"]
    return LaunchPlan(
        branch=branch_info.name,
        short_sha=branch_info.short_sha,
        run_path=run_path,
        desktop_dir=desktop_dir,
        start_command=start_command,
        creates_worktree=creates_worktree,
        symlinks=symlinks,
        in_place=in_place,
    )


def plan_as_json(plan: LaunchPlan, mode: str) -> str:
    payload = {
        "mode": mode,
        "branch": plan.branch,
        "shortSha": plan.short_sha,
        "runPath": str(plan.run_path),
        "desktopDir": str(plan.desktop_dir),
        "startCommand": plan.start_command,
        "createsWorktree": plan.creates_worktree,
        "inPlace": plan.in_place,
        "symlinks": [str(p) for p in plan.symlinks],
        "ephemeral": plan.creates_worktree,
        "writesSource": False,
        "touchesOutHtml": False,
        "switchesPrimaryBranch": False,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def branches_as_json(branches: list[BranchInfo]) -> str:
    payload = [
        {
            "name": b.name,
            "shortSha": b.short_sha,
            "date": b.date,
            "subject": b.subject,
            "checkedOutAt": b.checked_out_at,
            "isCurrent": b.is_current,
        }
        for b in branches
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)


def symlink_node_modules(plan: LaunchPlan) -> list[Path]:
    """Create the borrow-symlinks the plan needs; return the ones created."""
    created: list[Path] = []
    for link in plan.symlinks:
        rel = link.relative_to(plan.run_path)
        target = (REPO_ROOT / rel).resolve()
        if not target.exists():
            continue
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(target)
        created.append(link)
    return created


def ensure_run_path(plan: LaunchPlan) -> list[Path]:
    """Materialize the worktree + symlinks. Returns symlinks created (for cleanup)."""
    if plan.creates_worktree:
        plan.run_path.parent.mkdir(parents=True, exist_ok=True)
        if plan.run_path.exists():
            # Stale leftover from a crashed run; clear it before re-adding.
            remove_worktree(plan.run_path)
        git(["worktree", "add", "--detach", str(plan.run_path), plan.branch])
    return symlink_node_modules(plan)


def remove_symlinks(links: list[Path]) -> None:
    for link in links:
        try:
            if link.is_symlink() or link.exists():
                link.unlink()
        except OSError:
            pass


def remove_worktree(path: Path) -> None:
    subprocess.run(
        ["git", "worktree", "remove", "--force", str(path)],
        cwd=str(REPO_ROOT),
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    subprocess.run(
        ["git", "worktree", "prune"],
        cwd=str(REPO_ROOT),
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def cleanup(plan: LaunchPlan, created_symlinks: list[Path]) -> None:
    # Always drop the symlinks we added, even into a pre-existing worktree.
    remove_symlinks(created_symlinks)
    if plan.creates_worktree:
        remove_worktree(plan.run_path)


def electron_binary(plan: LaunchPlan) -> Path:
    return plan.desktop_dir / "node_modules" / ".bin" / "electron"


def prepare_and_report(plan: LaunchPlan) -> int:
    """Self-test: materialize everything, confirm electron resolves, tear down."""
    created = ensure_run_path(plan)
    try:
        ok = electron_binary(plan).exists()
        report = json.loads(plan_as_json(plan, "prepare"))
        report["electronResolved"] = ok
        report["runPathExists"] = plan.run_path.exists()
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if ok else 1
    finally:
        cleanup(plan, created)


def launch(plan: LaunchPlan) -> int:
    created = ensure_run_path(plan)
    try:
        if not electron_binary(plan).exists():
            print(
                "ERROR: electron is not installed. Run `npm --prefix tools/project_map/desktop ci` "
                "in the primary checkout first.",
                file=sys.stderr,
            )
            return 1
        where = "in place" if plan.in_place else "in an ephemeral worktree"
        print(f"Launching Dendry Mod Studio desktop app for '{plan.branch}' ({plan.short_sha}) {where}.")
        print(f"Run path: {plan.run_path}")
        print("Close the app window (or press Ctrl+C here) to stop and clean up.")
        print()
        result = subprocess.run(plan.start_command, cwd=str(plan.desktop_dir), check=False)
        return result.returncode
    except KeyboardInterrupt:
        return 0
    finally:
        cleanup(plan, created)
        if plan.creates_worktree:
            print("Cleaned up the ephemeral worktree.")


def pick_interactively(branches: list[BranchInfo]) -> BranchInfo | None:
    print("Local Studio branches (newest commit first):")
    print()
    for i, b in enumerate(branches, start=1):
        tags = []
        if b.is_current:
            tags.append("current")
        elif b.checked_out_at:
            tags.append("worktree")
        tag = f" [{', '.join(tags)}]" if tags else ""
        print(f"  {i:2}. {b.name}{tag}")
        print(f"      {b.short_sha}  {b.date}  {b.subject}")
    print()
    try:
        raw = input(f"Pick a branch to launch [1-{len(branches)}], or Enter to cancel: ").strip()
    except EOFError:
        return None
    if not raw:
        return None
    if not raw.isdigit() or not (1 <= int(raw) <= len(branches)):
        raise ValueError(f"'{raw}' is not a number between 1 and {len(branches)}.")
    return branches[int(raw) - 1]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="List local branches and launch a chosen branch's Studio desktop app.",
    )
    parser.add_argument("branch", nargs="?", default=None, help="Branch to launch; omit for an interactive picker.")
    parser.add_argument("--list", action="store_true", help="Print the local branches as JSON and exit.")
    parser.add_argument("--plan", action="store_true", help="Print the launch plan as JSON without creating a worktree or launching.")
    parser.add_argument("--prepare", action="store_true", help="Self-test: build the worktree + symlinks, confirm electron resolves, then tear down (no app window).")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        branches = list_branches()
        if not branches:
            print("No local branches found.", file=sys.stderr)
            return 1
        if args.list:
            print(branches_as_json(branches))
            return 0

        if args.branch:
            chosen = find_branch(branches, args.branch)
        else:
            chosen = pick_interactively(branches)
            if chosen is None:
                print("Cancelled.")
                return 0

        plan = build_launch_plan(chosen)
        if args.plan:
            print(plan_as_json(plan, "plan"))
            return 0
        if args.prepare:
            return prepare_and_report(plan)
        return launch(plan)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
