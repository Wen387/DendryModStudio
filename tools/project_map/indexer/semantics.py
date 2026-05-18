from .common import *
from .profiles import scene_has_timeline_event_evidence
from .news import extract_legacy_event_popups, extract_news
from .surface_text import extract_surface_text
from .text_corpus import extract_text_corpus
from .assets import extract_assets
from .election_results import extract_election_results
from .runtime_surface import extract_runtime_surface
from .semantic_evidence import build_parser_evidence

def classify_semantics(root: Path, scenes: list[dict[str, Any]],
                       variables: list[dict[str, Any]],
                       selected_profiles: list[dict[str, Any]],
                       post_event_summary: dict[str, Any] | None = None,
                       route_order_groups: list[dict[str, Any]] | None = None,
                       dynamic_key_evidence: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    events = []
    cards = []
    hands = []
    decks = []
    pinned_cards = []
    systems: dict[str, set[str]] = defaultdict(set)
    labels = []

    profile_system_rules = []
    variable_family_rules = []
    for profile_ref in selected_profiles:
        profile = profile_ref.get("_profile", {})
        rules = profile.get("classificationRules", {})
        for rule in rules.get("semanticSystems", []):
            profile_system_rules.append((profile_ref["id"], rule))
        for rule in rules.get("variableFamilies", []):
            variable_family_rules.append((profile_ref["id"], rule))

    for scene in scenes:
        scene_id = scene["id"]
        path = scene["path"]
        flags = scene.get("flags", {})
        tags = set(scene.get("tags", []))
        timeline_event = scene_has_timeline_event_evidence(scene) or scene.get("type") in {"event", "election"}
        scene_ref = {
            "id": scene_id,
            "path": path,
            "title": scene.get("title", ""),
            "type": scene.get("type", "scene"),
            "confidence": scene.get("classificationConfidence", CONF_PROFILE),
        }
        section_refs = []
        for section in scene.get("sections", []):
            section_refs.append({
                "id": section.get("id", ""),
                "path": path,
                "title": section.get("title", ""),
                "type": "section",
                "ownerKind": "section",
                "ownerSceneId": scene_id,
                "sourceSpan": section.get("sourceSpan", {}),
                "options": section.get("options", []),
                "tags": section.get("tags", []),
                "confidence": CONF_EXACT,
            })
        if timeline_event:
            events.append(scene_ref)
            systems["events"].add(scene_id)
        if (flags.get("isCard") or scene.get("type") in {"card", "pinned_card"}) and not timeline_event:
            cards.append(scene_ref)
            systems["cards"].add(scene_id)
        if (flags.get("isPinnedCard") or scene.get("type") == "pinned_card") and not timeline_event:
            pinned_cards.append(scene_ref)
            systems["pinned_cards"].add(scene_id)
        if flags.get("isHand") or scene.get("type") == "hand":
            hands.append(scene_ref)
            systems["hands"].add(scene_id)
        if flags.get("isDeck") or scene.get("type") == "deck":
            decks.append(scene_ref)
            systems["decks"].add(scene_id)
        for section_ref, section in zip(section_refs, scene.get("sections", [])):
            section_id = section_ref["id"]
            if not section_id:
                continue
            if boolish(section.get("isDeck")) or section.get("type") == "deck":
                deck_ref = dict(section_ref)
                deck_ref["type"] = "deck"
                decks.append(deck_ref)
                systems["decks"].add(section_id)
        if path.endswith("post_event.scene.dry") or path.endswith("post_event_news.scene.dry"):
            systems["monthly_tick"].add(scene_id)

        for profile_id, rule in profile_system_rules:
            path_regex = compile_regex(rule.get("pathRegex", ""))
            name_regex = compile_regex(rule.get("nameRegex", ""))
            matched = False
            if path_regex and path_regex.search(path):
                matched = True
            if name_regex and name_regex.search(scene_id):
                matched = True
            if matched:
                system_id = rule.get("system")
                if system_id:
                    systems[system_id].add(scene_id)
                    labels.append({
                        "target": scene_id,
                        "label": system_id,
                        "profileId": profile_id,
                        "confidence": 0.7,
                        "confidenceLabel": CONF_PROFILE,
                        "evidence": [path],
                    })

    variable_labels = []
    for variable in variables:
        name = variable["name"]
        families = []
        for profile_id, rule in variable_family_rules:
            regex = compile_regex(rule.get("nameRegex", ""))
            if regex and regex.search(name):
                families.append(rule.get("family"))
                variable_labels.append({
                    "target": f"variable:{name}",
                    "label": rule.get("family"),
                    "profileId": profile_id,
                    "confidence": 0.65,
                    "confidenceLabel": CONF_PROFILE,
                    "evidence": [name],
                })
        if families:
            variable["tags"] = sorted(set(variable.get("tags", []) + [f for f in families if f]))

    labels.extend(variable_labels)

    news = extract_news(root)
    news["eventPopups"] = extract_legacy_event_popups(root, scenes, post_event_summary)
    surface_text = extract_surface_text(root, variables)
    text_corpus = extract_text_corpus(root, scenes, news, surface_text)
    election_results = extract_election_results(root, scenes)
    runtime_surface = extract_runtime_surface(root)
    parser_evidence = build_parser_evidence(scenes, route_order_groups, dynamic_key_evidence, news, selected_profiles)

    return {
        "events": sorted(events, key=lambda item: item["id"]),
        "cards": sorted(cards, key=lambda item: item["id"]),
        "hands": sorted(hands, key=lambda item: item["id"]),
        "decks": sorted(decks, key=lambda item: item["id"]),
        "pinnedCards": sorted(pinned_cards, key=lambda item: item["id"]),
        "news": news,
        "surfaceText": surface_text,
        "textCorpus": text_corpus,
        "electionResults": election_results,
        "runtimeSurface": runtime_surface,
        "parserEvidence": parser_evidence,
        "assets": extract_assets(root, scenes),
        "systems": [
            {"id": system_id, "label": system_id.replace("_", " ").title(), "members": sorted(members)}
            for system_id, members in sorted(systems.items())
        ],
        "groups": [
            {"id": "events", "label": "Events", "members": sorted(item["id"] for item in events)},
            {"id": "cards", "label": "Cards", "members": sorted(item["id"] for item in cards)},
            {"id": "hands", "label": "Hands", "members": sorted(item["id"] for item in hands)},
            {"id": "decks", "label": "Decks", "members": sorted(item["id"] for item in decks)},
            {"id": "pinned_cards", "label": "Pinned Cards", "members": sorted(item["id"] for item in pinned_cards)},
        ],
        "labels": labels,
    }
