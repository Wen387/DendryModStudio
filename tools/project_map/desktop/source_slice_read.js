'use strict';

// Bounded read of a source-file line span. Read-only counterpart to the
// install machinery: the object editor uses it to load the CURRENT text of an
// over-cap `{! … !}` block before opening the Source Slice workspace (the
// index intentionally carries anchors only for oversized blocks). Only
// relative `source/**/*.dry` paths that resolve inside the already-validated
// project root are readable; rangeHash lets the eventual replace_section
// operation fail closed if the file changes between read and apply.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readSourceSlice(options) {
  const opts = options || {};
  const root = String(opts.root || '');
  const rel = String(opts.path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  const startLine = Math.floor(Number(opts.startLine || 0));
  const endLine = Math.floor(Number(opts.endLine || 0));
  const refuse = (code, message) => ({ok: false, code, message, path: rel});
  if (!root) {
    return refuse('read_slice.no_project', 'Open a project folder first.');
  }
  if (!/^source\/[^\0]+\.dry$/.test(rel) || rel.split('/').some((part) => part === '..' || part === '')) {
    return refuse('read_slice.path_refused', 'Only relative source/**/*.dry paths can be read.');
  }
  const absolute = path.resolve(root, rel);
  if (absolute !== path.join(root, rel) || !absolute.startsWith(root + path.sep)) {
    return refuse('read_slice.path_refused', 'Resolved path escapes the project root.');
  }
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    return refuse('read_slice.range_invalid', 'startLine/endLine must be a valid 1-based line range.');
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return refuse('read_slice.file_missing', 'Source file does not exist: ' + rel);
  }
  let text;
  try {
    text = fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    return refuse('read_slice.read_failed', 'Could not read ' + rel + ': ' + (err && err.message || err));
  }
  const lines = text.split(/\r\n|\n|\r/);
  if (endLine > lines.length) {
    return refuse('read_slice.range_invalid', 'endLine ' + endLine + ' is beyond the file (' + lines.length + ' lines).');
  }
  const slice = lines.slice(startLine - 1, endLine).join('\n');
  return {
    ok: true,
    path: rel,
    startLine,
    endLine,
    text: slice,
    rangeHash: crypto.createHash('sha256').update(slice, 'utf8').digest('hex'),
    totalLines: lines.length
  };
}

module.exports = {readSourceSlice};
