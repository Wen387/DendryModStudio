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
    deck_pools = build_deck_pools(scenes, decks)
    advisor_controllers = build_advisor_controllers(scenes)

    return {
        "events": sorted(events, key=lambda item: item["id"]),
        "cards": sorted(cards, key=lambda item: item["id"]),
        "hands": sorted(hands, key=lambda item: item["id"]),
        "decks": sorted(decks, key=lambda item: item["id"]),
        "deckPools": sorted(deck_pools, key=lambda item: item["id"]),
        "pinnedCards": sorted(pinned_cards, key=lambda item: item["id"]),
        "advisorControllers": sorted(advisor_controllers, key=lambda item: item["id"]),
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


def build_deck_pools(scenes: list[dict[str, Any]], decks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards = [scene for scene in scenes if scene.get("type") in {"card", "pinned_card"} or scene.get("flags", {}).get("isCard") or scene.get("flags", {}).get("isPinnedCard")]
    pools = []
    for deck in decks:
        options = deck.get("options", []) or []
        targets = [route_target(option) for option in options]
        targets = [target for target in targets if target.get("kind")]
        route_tags = sorted({target["id"] for target in targets if target.get("kind") == "tag"})
        direct_scene_ids = sorted({target["id"] for target in targets if target.get("kind") == "scene"})
        member_ids = []
        for card in cards:
            card_id = card.get("id", "")
            card_tags = set(card.get("tags", []))
            if card_id in direct_scene_ids or any(tag in card_tags for tag in route_tags):
                member_ids.append(card_id)
        kind = "dynamic_partial"
        if route_tags and direct_scene_ids:
            kind = "hybrid"
        elif deck.get("ownerKind") == "section":
            kind = "section_owned_deck"
        elif route_tags:
            kind = "tag_pool"
        elif direct_scene_ids:
            kind = "direct_scene_pool"
        pools.append({
            "id": deck.get("id", ""),
            "label": deck.get("title", "") or deck.get("id", ""),
            "ownerSceneId": deck.get("ownerSceneId", ""),
            "ownerSectionId": deck.get("id", "") if deck.get("ownerKind") == "section" else "",
            "path": deck.get("path", ""),
            "routeTags": route_tags,
            "directSceneIds": direct_scene_ids,
            "routeTargets": targets,
            "launcherRoutes": launcher_routes_for_pool(scenes, deck),
            "memberCardIds": sorted(member_ids),
            "sourceAnchor": deck.get("sourceSpan", {}),
            "kind": kind,
            "status": "partial" if kind in {"hybrid", "dynamic_partial"} else "ready",
        })
    return [pool for pool in pools if pool.get("id")]


def route_target(option: dict[str, Any]) -> dict[str, str]:
    target = option.get("target", {}) if isinstance(option, dict) else {}
    kind = target.get("kind", "")
    target_id = str(target.get("id", "")).lstrip("#@")
    option_id = str(option.get("id", "")) if isinstance(option, dict) else ""
    if kind in {"tag", "scene"} and target_id:
        return {"kind": kind, "id": target_id, "optionId": option_id}
    if option_id.startswith("#"):
        return {"kind": "tag", "id": option_id[1:], "optionId": option_id}
    if option_id.startswith("@"):
        return {"kind": "scene", "id": option_id[1:], "optionId": option_id}
    return {"kind": "", "id": "", "optionId": option_id}


def launcher_routes_for_pool(scenes: list[dict[str, Any]], deck: dict[str, Any]) -> list[dict[str, Any]]:
    targets = {str(deck.get("id", "")).split(".")[-1], str(deck.get("id", "")), str(deck.get("ownerSectionId", ""))}
    rows = []
    for scene in scenes:
        if not (scene.get("type") == "hand" or scene.get("flags", {}).get("isHand")):
            continue
        for option in scene.get("options", []):
            target = option.get("target", {})
            if target.get("kind") == "scene" and str(target.get("id", "")) in targets:
                rows.append({
                    "id": option.get("id", ""),
                    "label": option.get("title", "") or option.get("label", "") or option.get("id", ""),
                    "targetKind": "scene",
                    "targetId": target.get("id", ""),
                    "ownerSceneId": scene.get("id", ""),
                    "source": option.get("sourceSpan", {}),
                })
    return rows


def build_advisor_controllers(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    advisor_cards = [scene for scene in scenes if (scene.get("type") == "pinned_card" or scene.get("flags", {}).get("isPinnedCard")) and "advisor" in scene.get("tags", [])]
    variables = {advisor_variable(scene.get("viewIf", "")) for scene in advisor_cards}
    variables = {value for value in variables if value}
    controllers = []
    for scene in scenes:
        if scene.get("type") not in {"card", "pinned_card"} and not scene.get("flags", {}).get("isCard"):
            continue
        if scene.get("flags", {}).get("isPinnedCard"):
            continue
        effects = [effect for effect in scene.get("effects", []) if effect.get("variable") in variables]
        has_add = any(str(effect.get("value", "")) == "1" for effect in effects)
        has_remove = any(str(effect.get("value", "")) == "0" for effect in effects)
        if not (has_add and has_remove):
            continue
        roster = []
        for card in advisor_cards:
            variable = advisor_variable(card.get("viewIf", ""))
            if not variable:
                continue
            add = next((effect for effect in effects if effect.get("variable") == variable and str(effect.get("value", "")) == "1"), None)
            remove = next((effect for effect in effects if effect.get("variable") == variable and str(effect.get("value", "")) == "0"), None)
            if add or remove:
                roster.append({
                    "advisorId": card.get("id", ""),
                    "title": card.get("title", "") or card.get("id", ""),
                    "activeVariable": variable,
                    "categoryTags": [tag for tag in card.get("tags", []) if tag != "advisor"],
                    "pinnedCardSceneId": card.get("id", ""),
                    "addSectionId": add.get("sectionId", "") if add else "",
                    "removeSectionId": remove.get("sectionId", "") if remove else "",
                    "sourceAnchors": {
                        "pinnedCard": card.get("sourceSpan", {}),
                        "viewIf": card.get("metadata", {}).get("viewIf", {}),
                        "tags": card.get("metadata", {}).get("tags", {}),
                        "addEffect": add.get("source", {}) if add else {},
                        "removeEffect": remove.get("source", {}) if remove else {},
                    },
                    "confidence": "exact" if add and remove else "partial",
                })
        if roster:
            controllers.append({
                "id": scene.get("id", ""),
                "title": scene.get("title", "") or scene.get("id", ""),
                "controllerSceneId": scene.get("id", ""),
                "path": scene.get("path", ""),
                "roster": roster,
                "sourceAnchor": scene.get("sourceSpan", {}),
                "confidence": "exact" if all(item.get("confidence") == "exact" for item in roster) else "partial",
            })
    return controllers


def advisor_variable(view_if: str) -> str:
    text = str(view_if or "")
    for token in text.replace("==", "=").split():
        if token.endswith("_advisor"):
            return token
    return ""
