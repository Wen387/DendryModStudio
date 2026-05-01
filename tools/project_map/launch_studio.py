#!/usr/bin/env python3
"""Launch the local Dendry Mod Studio viewer.

This is a thin beginner shell over the existing Project Map tools. It writes
indexes to /tmp by default, serves only tools/project_map/viewer, and never
modifies source scenes or out/html.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import mimetypes
import socket
import subprocess
import sys
import urllib.parse
import webbrowser
from pathlib import Path
from typing import NamedTuple


SCRIPT_DIR = Path(__file__).resolve().parent
INDEXER = SCRIPT_DIR / "build_project_map.py"
VIEWER_DIR = SCRIPT_DIR / "viewer"
DEFAULT_OUT_DIR = Path("/tmp/dendry_project_map")
MAX_EXCERPT_CONTEXT_LINES = 5
ASSET_BASE_ROUTE = "/_project_asset"
ALLOWED_PROJECT_ASSET_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".mp3",
    ".ogg",
    ".wav",
    ".flac",
    ".m4a",
}


class LaunchPlan(NamedTuple):
    root: Path
    out_dir: Path
    index_path: Path
    index_route: str
    asset_base_route: str
    viewer_dir: Path
    url: str
    index_args: list[str]
    host: str
    port: int
    open_browser: bool
    include_excerpts: bool


def find_project_root(start: Path | str) -> Path:
    path = Path(start).resolve()
    if path.is_file():
        path = path.parent
    for candidate in (path, *path.parents):
        if (candidate / "source" / "info.dry").is_file():
            return candidate
    raise ValueError(f"Could not find source/info.dry from {path}")


def can_bind(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def pick_ephemeral_port(host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def choose_port(
    host: str,
    preferred_port: int,
    probe: bool = True,
    can_bind_fn=can_bind,
    any_port_fn=pick_ephemeral_port,
) -> int:
    if preferred_port < 0 or preferred_port > 65535:
        raise ValueError("--port must be between 0 and 65535.")
    if not probe:
        return preferred_port or 8765
    if preferred_port and can_bind_fn(host, preferred_port):
        return preferred_port
    return any_port_fn(host)


def ensure_not_repo_source_or_generated(root: Path, index_path: Path) -> None:
    root = root.resolve()
    index_path = index_path.resolve()
    for rel in ("source", "out/html", "out/game.json"):
        protected = (root / rel).resolve()
        try:
            if index_path == protected or index_path.relative_to(protected):
                raise ValueError(
                    f"Refusing to write Project Map index under {rel}. "
                    "Use /tmp/dendry_project_map or another scratch directory."
                )
        except ValueError as exc:
            if "Refusing" in str(exc):
                raise


def build_launch_plan(
    root: Path,
    out_dir: Path,
    include_excerpts: bool,
    excerpt_context_lines: int,
    host: str,
    preferred_port: int,
    open_browser: bool,
    probe_port: bool = True,
) -> LaunchPlan:
    root = find_project_root(root)
    out_dir = Path(out_dir).expanduser()
    index_name = "project-index-excerpts.json" if include_excerpts else "project-index.json"
    index_path = out_dir / index_name
    index_route = "/" + index_name
    ensure_not_repo_source_or_generated(root, index_path)
    port = choose_port(host, preferred_port, probe=probe_port)
    query = urllib.parse.urlencode([
        ("index", index_route),
        ("assetBase", ASSET_BASE_ROUTE),
    ], safe="/")
    url = f"http://{host}:{port}/index.html?{query}"

    index_args = [
        sys.executable,
        str(INDEXER),
        "--root",
        str(root),
        "--out",
        str(index_path),
    ]
    if include_excerpts:
        index_args.extend([
            "--include-excerpts",
            "--excerpt-context-lines",
            str(excerpt_context_lines),
        ])
    index_args.append("--summary")

    return LaunchPlan(
        root=root,
        out_dir=out_dir,
        index_path=index_path,
        index_route=index_route,
        asset_base_route=ASSET_BASE_ROUTE,
        viewer_dir=VIEWER_DIR,
        url=url,
        index_args=index_args,
        host=host,
        port=port,
        open_browser=open_browser,
        include_excerpts=include_excerpts,
    )


def plan_as_json(plan: LaunchPlan, mode: str) -> str:
    payload = {
        "mode": mode,
        "root": str(plan.root),
        "indexPath": str(plan.index_path),
        "indexRoute": plan.index_route,
        "assetBaseRoute": plan.asset_base_route,
        "viewerDir": str(plan.viewer_dir),
        "url": plan.url,
        "indexCommand": plan.index_args,
        "includeExcerpts": plan.include_excerpts,
        "openBrowser": plan.open_browser,
        "readOnly": True,
        "writesSource": False,
        "touchesOutHtml": False,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def run_indexer(plan: LaunchPlan) -> None:
    print("Generating ProjectIndex...")
    result = subprocess.run(plan.index_args, cwd=plan.root, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Project index generation failed with exit code {result.returncode}.")


def resolve_project_asset_path(root: Path, asset_base_route: str, request_path: str) -> Path | None:
    prefix = asset_base_route.rstrip("/") + "/"
    if not request_path.startswith(prefix):
        return None
    relative_url = request_path[len(prefix):]
    relative_path = urllib.parse.unquote(relative_url).replace("\\", "/").lstrip("/")
    if not relative_path:
        return None
    candidate = (root / relative_path).resolve()
    root = root.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise PermissionError("Project asset path escapes the project root.") from exc
    if candidate.suffix.lower() not in ALLOWED_PROJECT_ASSET_EXTENSIONS:
        raise PermissionError("Project asset route only serves image and audio files.")
    return candidate


def serve_viewer(plan: LaunchPlan) -> None:
    class StudioHandler(http.server.SimpleHTTPRequestHandler):
        def write_response_bytes(self, data: bytes) -> None:
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                return

        def do_GET(self):
            request_path = urllib.parse.urlparse(self.path).path
            if request_path == plan.index_route:
                try:
                    data = plan.index_path.read_bytes()
                except OSError:
                    self.send_error(404, "Project index not found")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.write_response_bytes(data)
                return
            if request_path.startswith(plan.asset_base_route.rstrip("/") + "/"):
                try:
                    asset_path = resolve_project_asset_path(plan.root, plan.asset_base_route, request_path)
                except PermissionError as exc:
                    self.send_error(403, str(exc))
                    return
                if not asset_path or not asset_path.is_file():
                    self.send_error(404, "Project asset not found")
                    return
                try:
                    data = asset_path.read_bytes()
                except OSError:
                    self.send_error(404, "Project asset not found")
                    return
                content_type = mimetypes.guess_type(asset_path.name)[0] or "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                self.write_response_bytes(data)
                return
            super().do_GET()

    handler = functools.partial(StudioHandler, directory=str(plan.viewer_dir))
    server = http.server.ThreadingHTTPServer((plan.host, plan.port), handler)
    print()
    print("Dendry Mod Studio local viewer is ready.")
    print(f"URL: {plan.url}")
    print(f"Index JSON: {plan.index_path}")
    print("The page should auto-load this index; use the file picker only as a fallback.")
    print("This launcher is read-only/export-only: it does not edit source or out/html.")
    print("Press Ctrl+C to stop the viewer.")
    print()
    if plan.open_browser:
        webbrowser.open(plan.url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped Dendry Mod Studio local viewer.")
    finally:
        server.server_close()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a ProjectIndex and launch the local static viewer.")
    parser.add_argument("--root", default=".", help="Dendry project root; defaults to the current directory.")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Scratch output directory for ProjectIndex JSON.")
    parser.add_argument("--include-excerpts", action="store_true", help="Generate project-index-excerpts.json for review.")
    parser.add_argument("--excerpt-context-lines", type=int, default=1, help="Excerpt context lines when --include-excerpts is set.")
    parser.add_argument("--host", default="127.0.0.1", help="Viewer host; defaults to 127.0.0.1.")
    parser.add_argument("--port", type=int, default=8765, help="Preferred viewer port; if busy, an open port is selected.")
    parser.add_argument("--no-open", action="store_true", help="Do not ask the OS to open a browser.")
    parser.add_argument("--dry-run", action="store_true", help="Print the launch plan as JSON without building or serving.")
    args = parser.parse_args(argv)
    if args.excerpt_context_lines < 0:
        parser.error("--excerpt-context-lines must be >= 0.")
    if args.excerpt_context_lines > MAX_EXCERPT_CONTEXT_LINES:
        parser.error(f"--excerpt-context-lines must be <= {MAX_EXCERPT_CONTEXT_LINES}.")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        plan = build_launch_plan(
            root=Path(args.root),
            out_dir=Path(args.out_dir),
            include_excerpts=bool(args.include_excerpts),
            excerpt_context_lines=int(args.excerpt_context_lines),
            host=str(args.host),
            preferred_port=int(args.port),
            open_browser=not bool(args.no_open),
            probe_port=not bool(args.dry_run),
        )
        if args.dry_run:
            print(plan_as_json(plan, "dry-run"))
            return 0
        run_indexer(plan)
        serve_viewer(plan)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
