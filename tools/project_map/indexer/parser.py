from .common import *

def run_node_parser(root: Path) -> dict[str, Any]:
    result = subprocess.run(
        ["node", str(PARSER_WRAPPER), "--root", str(root)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if not result.stdout.strip():
        detail = (result.stderr or "").strip()
        raise RuntimeError(f"Node parser produced no JSON. {detail}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not decode Node parser output: {exc}") from exc
    if result.returncode not in {0, 1}:
        detail = (result.stderr or "").strip()
        raise RuntimeError(f"Node parser failed with exit {result.returncode}: {detail}")
    data["_stderr"] = result.stderr.strip()
    data["_returncode"] = result.returncode
    return data


def load_parser_index(path: Path) -> dict[str, Any]:
    try:
        parser_index = load_json(path)
    except Exception as exc:
        raise RuntimeError(f"Could not load parser index {path}: {exc}") from exc
    if not isinstance(parser_index, dict):
        raise RuntimeError(f"Parser index {path} must be a JSON object.")
    parser_index.setdefault("_stderr", "")
    parser_index.setdefault("_returncode", 0)
    return parser_index
