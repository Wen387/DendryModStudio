# guided_route_edit_workbench_flow

Desktop QA scenario for Guided Route Editing Rules.

- Opens the real Studio renderer.
- Loads a minimized synthetic route fixture in renderer memory.
- Verifies Route Map exposes guided action chips for utility pair, route table binding, and explicit fallback.
- Builds Semantic Logic proposals and checks they use existing `replace_text` operations:
  - utility pair emits two operations in one review plan,
  - route table changes only literal target values,
  - explicit fallback emits a complement predicate.

The fixture is synthetic and does not copy private DynamicRepo content.
