Bundled desktop runtimes are staged here during release builds.

`scripts/fetch_bundled_python.js` downloads a redistributable Python build into
`runtime/python/` before packaging. The runtime payload itself is generated
during CI and is intentionally not committed.
