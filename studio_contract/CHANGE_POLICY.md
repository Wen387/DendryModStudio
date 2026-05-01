# Studio Contract Change Policy

This policy keeps IslandSunrise engine work and Dendry Mod Studio parser work in sync after the repos split. It applies to the `islands-sunrise` profile contract.

## When To Update This Contract

Update `studio_contract/` in the same change when a game-side edit does any of the following:

- Renames or removes a stable router declared in `contract.json`.
- Changes the root init or save migration convention.
- Adds, removes, or renames a major variable family Studio should classify.
- Moves player-visible source-backed text into generated/custom `out/html`, or moves generated UI text back into source.
- Changes Circle, district, local governance, collective, coverage, founding, diplomacy, or strategy-sidebar source layout.
- Adds a new authoring DSL that Studio is expected to parse.
- Changes install safety expectations for source-backed text, routers, protected UI, or coverage/population writes.

## Versioning

- Patch version: documentation wording, typo fixes, fixture comments, or schema descriptions only.
- Minor version: adds a new stable system, variable family, fixture scene, expected capability, or non-breaking contract field.
- Major version: removes or renames a stable convention that Studio may already rely on.

## Review Rule

For any non-patch contract change, the author must answer three questions in the PR body, release note, or maintainer note:

1. Which Studio parser or install behavior is affected?
2. Which fixture evidence proves the new convention?
3. Can old Studio builds still open the game project safely, even if with manual-review fallbacks?

## Required Checks

Run:

```bash
node tools/check_studio_contract.js
```

For Studio parser changes, also run the relevant `tools/project_map` fixture checks listed in `tools/project_map/WORKFLOW.md`.
