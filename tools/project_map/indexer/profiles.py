from .common import *
from .assets import extract_scene_asset_references

def score_profiles(root: Path, parser_index: dict[str, Any]) -> list[dict[str, Any]]:
    profiles = load_profiles()
    files = iter_project_files(root)
    rel_files = [posix_rel(path, root) for path in files]

    content_candidates = []
    for path in files:
        rel = posix_rel(path, root)
        if rel == POST_EVENT_REL:
            continue
        if is_generated_artifact(rel):
            continue
        if path.suffix.lower() not in {".dry", ".md", ".json", ".js"}:
            continue
        if path.stat().st_size > 512 * 1024:
            continue
        content_candidates.append(path)

    scored = []
    for profile in profiles:
        score = 0.0
        evidence: list[str] = []
        detection = profile.get("detection", {})

        for hint in detection.get("pathHints", []):
            pattern = hint.get("pattern", "")
            if pattern and glob_exists(root, pattern):
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"path:{pattern}")

        for hint in detection.get("fileNameHints", []):
            pattern = hint.get("pattern", "")
            if not pattern:
                continue
            if any(fnmatch.fnmatch(Path(rel).name, pattern) or fnmatch.fnmatch(rel, pattern)
                   for rel in rel_files):
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"file:{pattern}")

        for hint in detection.get("contentHints", []):
            pattern = hint.get("regex", "")
            if not pattern:
                continue
            regex = re.compile(pattern, re.MULTILINE)
            matched = False
            for candidate in content_candidates:
                try:
                    if regex.search(read_text_prefix(candidate)):
                        matched = True
                        break
                except Exception:
                    continue
            if matched:
                weight = float(hint.get("weight", 0))
                score += weight
                evidence.append(f"content:{pattern}")

        # A parser-backed scene set is enough to include generic-dendry.
        if profile.get("id") == "generic-dendry" and parser_index.get("sceneCount", 0) > 0:
            score = max(score, 0.75)
            evidence.append("parser:sceneCount>0")

        scored.append({
            "id": profile.get("id"),
            "name": profile.get("name", profile.get("id")),
            "version": profile.get("profileVersion", "0.1"),
            "priority": profile.get("priority", 0),
            "confidence": round(min(score, 1.0), 3),
            "confidenceLabel": CONF_PROFILE,
            "evidence": evidence[:10],
            "_profile": profile,
        })

    selected_ids = {item["id"] for item in scored if item["confidence"] >= 0.25}
    if parser_index.get("sceneCount", 0) > 0:
        selected_ids.add("generic-dendry")

    by_id = {profile.get("id"): profile for profile in profiles}

    def include_parents(profile_id: str) -> None:
        profile = by_id.get(profile_id)
        parent = profile.get("extends") if profile else None
        if parent and parent not in selected_ids:
            selected_ids.add(parent)
            include_parents(parent)

    for profile_id in list(selected_ids):
        include_parents(profile_id)

    return sorted(
        [item for item in scored if item["id"] in selected_ids],
        key=lambda item: (item.get("priority", 0), item["id"]),
    )

def profile_rule_match(rule: dict[str, Any], scene: dict[str, Any]) -> bool:
    path = scene.get("path", "")
    name = scene.get("id", "")
    path_regex = rule.get("pathRegex")
    name_regex = rule.get("nameRegex")
    if path_regex:
        regex = compile_regex(path_regex)
        if not regex or not regex.search(path):
            return False
    if name_regex:
        regex = compile_regex(name_regex)
        if not regex or not regex.search(name):
            return False
    return bool(path_regex or name_regex)


def scene_has_timeline_event_evidence(scene: dict[str, Any]) -> bool:
    path = scene.get("path", "")
    tags = set(split_tags(scene.get("tags")))
    return "event" in tags or "/events/" in path or "/event/" in path


def classify_scene(scene: dict[str, Any], selected_profiles: list[dict[str, Any]]) -> tuple[str, str, str | None]:
    if boolish(scene.get("isDeck")):
        return "deck", CONF_EXACT, None
    if boolish(scene.get("isHand")):
        return "hand", CONF_EXACT, None
    if scene_has_timeline_event_evidence(scene):
        for profile_ref in sorted(selected_profiles, key=lambda p: p.get("priority", 0), reverse=True):
            profile = profile_ref.get("_profile", {})
            for rule in profile.get("classificationRules", {}).get("sceneTypes", []):
                if rule.get("type") in {"event", "election"} and profile_rule_match(rule, scene):
                    return rule.get("type", "event"), CONF_PROFILE, profile_ref.get("id")
        return "event", CONF_EXACT, None
    if boolish(scene.get("isCard")):
        return "card", CONF_EXACT, None
    if boolish(scene.get("isPinnedCard")):
        return "pinned_card", CONF_EXACT, None

    for profile_ref in sorted(selected_profiles, key=lambda p: p.get("priority", 0), reverse=True):
        profile = profile_ref.get("_profile", {})
        for rule in profile.get("classificationRules", {}).get("sceneTypes", []):
            if profile_rule_match(rule, scene):
                return rule.get("type", "scene"), CONF_PROFILE, profile_ref.get("id")
    return "scene", CONF_PROFILE, None


def normalize_parser_scene(scene: dict[str, Any], root: Path,
                           selected_profiles: list[dict[str, Any]]) -> dict[str, Any]:
    path = scene.get("path", "")
    scene_type, classification_confidence, profile_id = classify_scene(scene, selected_profiles)
    out: dict[str, Any] = {
        "id": scene.get("id"),
        "name": scene.get("id"),
        "title": scene.get("title", ""),
        "path": path,
        "type": scene_type,
        "profileId": profile_id,
        "confidence": CONF_EXACT,
        "classificationConfidence": classification_confidence,
        "sourceSpan": span_ref(path, scene.get("sourceSpan")),
        "topLevelSpan": span_ref(path, scene.get("topLevelSpan")),
        "metadata": normalize_metadata_paths(scene.get("metadata", {}), root),
        "tags": split_tags(scene.get("tags")),
        "flags": {
            "isCard": boolish(scene.get("isCard")),
            "isPinnedCard": boolish(scene.get("isPinnedCard")),
            "isHand": boolish(scene.get("isHand")),
            "isDeck": boolish(scene.get("isDeck")),
            "isSpecial": boolish(scene.get("isSpecial")),
        },
        "routes": scene.get("routes", {}),
        "options": [],
        "sections": [],
    }
    fingerprint = source_fingerprint(root, path, out.get("topLevelSpan"))
    if fingerprint:
        out["sourceFingerprint"] = fingerprint
    for field in [
        "viewIf",
        "chooseIf",
        "priority",
        "frequency",
        "frequencyVar",
        "maxVisits",
        "maxVisitsVar",
        "newPage",
        "setRoot",
        "gameOver",
    ]:
        if field in scene:
            out[field] = scene[field]

    for option in scene.get("options", []):
        item = dict(option)
        item["metadata"] = normalize_metadata_paths(item.get("metadata", {}), root)
        item["sourceSpan"] = span_ref(path, item.get("sourceSpan"))
        out["options"].append(item)

    for section in scene.get("sections", []):
        item = dict(section)
        item["metadata"] = normalize_metadata_paths(item.get("metadata", {}), root)
        item["sourceSpan"] = span_ref(path, item.get("sourceSpan"))
        item["tags"] = split_tags(item.get("tags"))
        item["options"] = []
        for option in section.get("options", []):
            opt_item = dict(option)
            opt_item["metadata"] = normalize_metadata_paths(opt_item.get("metadata", {}), root)
            opt_item["sourceSpan"] = span_ref(path, opt_item.get("sourceSpan"))
            item["options"].append(opt_item)
        out["sections"].append(item)
    asset_refs = extract_scene_asset_references(root, out)
    if asset_refs:
        out["assetRefs"] = asset_refs
    return out
