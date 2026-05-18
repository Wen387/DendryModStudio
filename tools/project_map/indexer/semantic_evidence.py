from .common import *


def build_parser_evidence(
    scenes: list[dict[str, Any]],
    route_order_groups: list[dict[str, Any]] | None = None,
    dynamic_key_evidence: list[dict[str, Any]] | None = None,
    news: dict[str, Any] | None = None,
    selected_profiles: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    route_groups = list(route_order_groups or [])
    dynamic_keys = list(dynamic_key_evidence or [])
    effect_clauses = build_effect_clauses(scenes)
    core = build_core_evidence(route_groups, dynamic_keys, effect_clauses)
    profiles = build_profile_evidence(selected_profiles or [], news or {})
    monthly_table = compatibility_monthly_popup_router_table(profiles)
    return {
        "schemaVersion": "0.2",
        "kind": "parser_semantic_evidence",
        "core": core,
        "profiles": profiles,
        # Compatibility aliases for Goal AC consumers. New code should prefer
        # core/profile evidence, but old checks and user data can keep reading
        # the original fields during the transition.
        "routeOrderGroups": route_groups,
        "dynamicKeyEvidence": dynamic_keys,
        "effectClauses": effect_clauses,
        "monthlyPopupRouterTable": monthly_table,
        "summary": build_parser_evidence_summary(core, profiles, monthly_table),
    }


def build_core_evidence(
    route_groups: list[dict[str, Any]],
    dynamic_keys: list[dict[str, Any]],
    effect_clauses: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "routeOrderGroups": route_groups,
        "dynamicKeyEvidence": dynamic_keys,
        "effectClauses": effect_clauses,
        "summary": {
            "routeOrderGroupCount": len(route_groups),
            "routeOrderClauseCount": sum(len(item.get("clauses", [])) for item in route_groups),
            "dynamicKeyEvidenceCount": len(dynamic_keys),
            "dynamicKeyManualReviewCount": sum(1 for item in dynamic_keys if item.get("reviewBoundary") == "manual_review"),
            "dynamicKeySafeExpansionCount": sum(1 for item in dynamic_keys if item.get("safeExpansion") is True),
            "effectClauseCount": len(effect_clauses),
            "effectClauseManualReviewCount": sum(1 for item in effect_clauses if item.get("installSafety") == "manual_review"),
            "effectClauseGuardedCandidateCount": sum(1 for item in effect_clauses if item.get("installSafety") == "guarded_candidate"),
        },
    }


def build_parser_evidence_summary(
    core: dict[str, Any],
    profiles: list[dict[str, Any]],
    monthly_table: list[dict[str, Any]],
) -> dict[str, Any]:
    core_summary = core.get("summary", {})
    packages = [package for profile in profiles for package in profile.get("packages", [])]
    router_tables = [table for profile in profiles for table in profile.get("routerTables", [])]
    return {
        **core_summary,
        "profileEvidenceCount": len(profiles),
        "profilePackageCount": len(packages),
        "profileRouterTableCount": len(router_tables),
        "profileProtectedBoundaryCount": sum(len(profile.get("protectedBoundaries", [])) for profile in profiles),
        "profileVariableSystemCount": sum(len(profile.get("variableSystems", [])) for profile in profiles),
        "monthlyPopupRouterCount": len(monthly_table),
        "monthlyPopupRouterManualReviewCount": sum(1 for item in monthly_table if item.get("installSafety") == "manual_review"),
    }


def build_profile_evidence(selected_profiles: list[dict[str, Any]], news: dict[str, Any]) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for profile_ref in selected_profiles:
        profile = profile_ref.get("_profile", {}) if isinstance(profile_ref, dict) else {}
        profile_id = str(profile_ref.get("id") or profile.get("id") or "")
        if not profile_id:
            continue
        rules = profile.get("classificationRules", {})
        packages: list[dict[str, Any]] = []
        router_tables: list[dict[str, Any]] = []
        for rule in rules.get("evidencePackages", []):
            package, router_table = build_profile_evidence_package(profile_id, rule, news)
            if package:
                packages.append(package)
            if router_table:
                router_tables.append(router_table)
        protected_boundaries = [
            normalize_profile_rule("protected_boundary", profile_id, item)
            for item in rules.get("protectedBoundaries", [])
        ]
        variable_systems = [
            normalize_profile_rule("variable_family", profile_id, item)
            for item in rules.get("variableFamilies", [])
        ]
        if packages or router_tables or protected_boundaries or variable_systems:
            profiles.append({
                "profileId": profile_id,
                "profileName": str(profile_ref.get("name") or profile.get("name") or profile_id),
                "packages": packages,
                "routerTables": router_tables,
                "protectedBoundaries": protected_boundaries,
                "variableSystems": variable_systems,
                "summary": {
                    "packageCount": len(packages),
                    "routerTableCount": len(router_tables),
                    "protectedBoundaryCount": len(protected_boundaries),
                    "variableSystemCount": len(variable_systems),
                },
            })
    return profiles


def build_profile_evidence_package(
    profile_id: str,
    rule: dict[str, Any],
    news: dict[str, Any],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    source = str(rule.get("source") or "")
    kind = str(rule.get("kind") or "")
    if source != "news.eventPopups" or kind not in {"router_table", "legacy_event_popup_router"}:
        return None, None
    package_id = str(rule.get("id") or stable_id("profile_package", profile_id, kind, source))
    router_table_id = str(rule.get("routerTableId") or f"{package_id}_table")
    rows = build_popup_router_rows(news, rule, profile_id, package_id, router_table_id)
    install_safety = str(rule.get("installSafety") or "manual_review")
    label = str(rule.get("label") or package_id.replace("_", " ").title())
    reason = str(rule.get("reason") or "Profile-declared router evidence remains manual review.")
    recommended_next_action = str(rule.get("recommendedNextAction") or "Review profile router evidence before install.")
    router_table = {
        "id": router_table_id,
        "profileId": profile_id,
        "packageId": package_id,
        "kind": kind,
        "source": source,
        "rows": rows,
        "rowCount": len(rows),
        "installSafety": install_safety,
        "reviewBoundary": str(rule.get("reviewBoundary") or install_safety),
        "reason": reason,
        "recommendedNextAction": recommended_next_action,
        "compatAlias": str(rule.get("compatAlias") or ""),
    }
    package = {
        "id": package_id,
        "profileId": profile_id,
        "kind": kind,
        "label": label,
        "rowCount": len(rows),
        "ownerCount": len({row.get("linkedSceneId", row.get("id", "")) for row in rows if row.get("linkedSceneId") or row.get("id")}),
        "installSafety": install_safety,
        "status": "active" if rows else "empty",
        "reason": reason,
        "recommendedNextAction": recommended_next_action,
        "evidence": {
            "routerTableId": router_table_id,
            "routerTable": rows[:8],
            "source": source,
        },
        "display": rule.get("display", {}),
        "compatAlias": str(rule.get("compatAlias") or ""),
    }
    return package, router_table


def build_popup_router_rows(
    news: dict[str, Any],
    rule: dict[str, Any],
    profile_id: str,
    package_id: str,
    router_table_id: str,
) -> list[dict[str, Any]]:
    rows = []
    row_kind = str(rule.get("rowKind") or "profile_router_entry")
    for popup in news.get("eventPopups", []):
        linked_scene_id = str(popup.get("linkedSceneId") or popup.get("sceneId") or "")
        router = source_ref_from_any(popup.get("router", {}))
        source = source_ref_from_any(popup.get("excerptSource") or popup.get("source") or {})
        row_id = stable_id(row_kind, linked_scene_id, router.get("path", ""), router.get("line", ""))
        rows.append({
            "id": row_id,
            "kind": row_kind,
            "profileId": profile_id,
            "packageId": package_id,
            "routerTableId": router_table_id,
            "compatAlias": str(rule.get("compatAlias") or ""),
            "linkedSceneId": linked_scene_id,
            "title": str(popup.get("title") or popup.get("headline") or linked_scene_id),
            "delivery": str(popup.get("delivery") or "legacy_event_popup"),
            "viewIf": str(popup.get("viewIf") or ""),
            "router": {
                "tag": str((popup.get("router") or {}).get("tag") or ""),
                "anchor": str((popup.get("router") or {}).get("anchor") or ""),
                "source": router,
            },
            "contentSource": source,
            "contentRoute": str(rule.get("contentRoute") or "linked_event"),
            "editorRoute": str(rule.get("editorRoute") or "object_workspace"),
            "installSafety": str(rule.get("installSafety") or "manual_review"),
            "reviewBoundary": str(rule.get("reviewBoundary") or rule.get("installSafety") or "manual_review"),
            "reason": str(rule.get("reason") or "Profile-declared router evidence remains manual review."),
            "recommendedNextAction": str(rule.get("recommendedNextAction") or "Review profile router evidence before install."),
            "confidence": str(popup.get("confidence") or CONF_STATIC),
        })
    return sorted(rows, key=lambda item: (item.get("linkedSceneId", ""), item.get("id", "")))


def compatibility_monthly_popup_router_table(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for profile in profiles:
        for table in profile.get("routerTables", []):
            if table.get("compatAlias") == "monthlyPopupRouterTable":
                rows.extend(table.get("rows", []))
    return sorted(rows, key=lambda item: (item.get("linkedSceneId", ""), item.get("id", "")))


def normalize_profile_rule(kind: str, profile_id: str, rule: dict[str, Any]) -> dict[str, Any]:
    rule_id = str(rule.get("id") or rule.get("boundary") or rule.get("family") or stable_id(kind, profile_id, json.dumps(rule, sort_keys=True)))
    out = {
        "id": rule_id,
        "profileId": profile_id,
        "kind": kind,
        "label": str(rule.get("label") or rule.get("boundary") or rule.get("family") or rule_id).replace("_", " "),
    }
    for key, value in rule.items():
        if key not in out:
            out[key] = value
    return out


def build_effect_clauses(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    effects: list[dict[str, Any]] = []
    for scene in scenes:
        for effect in scene.get("effects", []):
            source = source_ref_from_any(effect.get("source", {}))
            if not source.get("path"):
                continue
            effects.append({
                "scene": scene,
                "effect": effect,
                "source": source,
            })

    line_counts: Counter[str] = Counter()
    expression_counts: Counter[str] = Counter()
    for item in effects:
        source = item["source"]
        effect = item["effect"]
        line_key = source_key(source)
        expression_key = line_key + "\0" + str(effect.get("sourceExpression") or effect.get("expression") or "")
        line_counts[line_key] += 1
        expression_counts[expression_key] += 1

    clauses: list[dict[str, Any]] = []
    for item in effects:
        scene = item["scene"]
        effect = item["effect"]
        source = item["source"]
        line_key = source_key(source)
        source_expression = str(effect.get("sourceExpression") or effect.get("expression") or "")
        expression_key = line_key + "\0" + source_expression
        anchor_text = str(source.get("anchorText") or "")
        exact_token_count = anchor_text.count(source_expression) if anchor_text and source_expression else 0
        token_unique = expression_counts[expression_key] == 1 and (not anchor_text or exact_token_count <= 1)
        install_safety = "guarded_candidate" if token_unique else "manual_review"
        clause_id = str(effect.get("id") or "") or stable_id("effect_clause", line_key, source_expression)
        clauses.append({
            "id": clause_id,
            "sceneId": str(scene.get("id", "")),
            "ownerId": str(effect.get("sectionId") or scene.get("id", "")),
            "ownerKind": "section" if effect.get("sectionId") else str(scene.get("type", "scene")),
            "variable": str(effect.get("variable", "")),
            "op": str(effect.get("op") or effect.get("operator") or ""),
            "value": "" if effect.get("value") is None else str(effect.get("value", "")),
            "condition": str(effect.get("condition", "")),
            "hook": str(effect.get("hook", "")),
            "sourceExpression": source_expression,
            "displayExpression": str(effect.get("displayExpression") or effect.get("expression") or ""),
            "clauseOrder": int(effect.get("sourceOrder") or 0),
            "lineEffectCount": line_counts[line_key],
            "sharedLineGroupId": stable_id("effect_line", line_key),
            "tokenUniqueOnLine": token_unique,
            "source": source,
            "categories": ["write-backed"] + ([] if token_unique else ["manual-review"]),
            "installSafety": install_safety,
            "reviewBoundary": install_safety,
            "reason": (
                "Effect clause has unique source evidence and can be considered a guarded candidate."
                if token_unique
                else "Effect clause shares ambiguous source-line evidence and remains manual review."
            ),
            "confidence": str(effect.get("confidence") or CONF_STATIC),
        })
    return sorted(clauses, key=lambda item: (
        item.get("source", {}).get("path", ""),
        item.get("source", {}).get("line") or item.get("source", {}).get("startLine") or 0,
        item.get("clauseOrder") or 0,
        item.get("variable", ""),
    ))


def source_ref_from_any(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    path = str(source.get("path") or source.get("sourcePath") or "")
    line = source.get("line") or source.get("startLine")
    end_line = source.get("endLine") or line
    out = source_ref(path, line if isinstance(line, int) else None)
    if isinstance(line, int) and line > 0:
        out["startLine"] = line
    if isinstance(end_line, int) and end_line > 0:
        out["endLine"] = end_line
    if source.get("anchorText"):
        out["anchorText"] = str(source.get("anchorText"))
    if source.get("endAnchorText"):
        out["endAnchorText"] = str(source.get("endAnchorText"))
    if source.get("rawAnchorText"):
        out["rawAnchorText"] = str(source.get("rawAnchorText"))
    if source.get("rawEndAnchorText"):
        out["rawEndAnchorText"] = str(source.get("rawEndAnchorText"))
    if source.get("expectedRangeHash"):
        out["expectedRangeHash"] = str(source.get("expectedRangeHash"))
    return out


def source_key(source: dict[str, Any]) -> str:
    return ":".join([
        str(source.get("path") or ""),
        str(source.get("line") or source.get("startLine") or ""),
    ])


def stable_id(prefix: str, *parts: Any) -> str:
    raw = ":".join(str(part) for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"
