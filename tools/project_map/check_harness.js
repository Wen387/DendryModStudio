// @ts-check
'use strict';

/**
 * Print "FAIL: <message>" (plus an optional JSON detail block) to stderr
 * and exit with code 1.
 *
 * @param {string} message
 * @param {unknown} [detail] Optional structured detail. When provided, it is
 *   pretty-printed as JSON on the line after the FAIL message.
 * @returns {never}
 */
function fail(message, detail) {
  const suffix = detail !== undefined ? '\n' + JSON.stringify(detail, null, 2) : '';
  process.stderr.write('FAIL: ' + String(message) + suffix + '\n');
  process.exit(1);
}

/**
 * Fail the check unless `condition` is truthy.
 *
 * @param {unknown} condition
 * @param {string} message
 * @param {unknown} [detail]
 */
function assert(condition, message, detail) {
  if (!condition) {
    fail(message, detail);
  }
}

/**
 * Machine-readable variant of {@link fail}. Emits a single JSON object
 * `{ok: false, message, ...details}` to stderr and exits with code 1.
 *
 * Used by checks whose stderr is consumed by tooling (CI dashboards,
 * structured log parsers).
 *
 * `details` is intentionally typed as `unknown` to preserve the original
 * inline signature's tolerance for non-object payloads (arrays, primitives).
 *
 * @param {string} message
 * @param {unknown} [details]
 * @returns {never}
 */
function failJson(message, details) {
  const payload = Object.assign({ok: false, message}, details || {});
  process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(1);
}

/**
 * Assert variant that uses {@link failJson} on failure.
 *
 * @param {unknown} condition
 * @param {string} message
 * @param {unknown} [details]
 */
function assertJson(condition, message, details) {
  if (!condition) {
    failJson(message, details);
  }
}

module.exports = { fail, assert, failJson, assertJson };
