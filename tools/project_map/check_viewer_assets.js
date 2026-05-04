#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function inlineCssImports(cssPath, seen) {
  const visited = seen || new Set();
  const absolutePath = path.resolve(cssPath);
  if (visited.has(absolutePath)) {
    return '';
  }
  visited.add(absolutePath);
  const source = readText(absolutePath);
  const dir = path.dirname(absolutePath);
  return source.replace(/@import\s+url\(["']?([^"')]+)["']?\)\s*;/g, (_match, rel) => {
    return inlineCssImports(path.join(dir, rel), visited);
  });
}

function readViewerCss(viewerDir) {
  return inlineCssImports(path.join(viewerDir, 'styles.css'));
}

function readViewerI18n(viewerDir) {
  const parts = [path.join(viewerDir, 'i18n.js')];
  const catalogDir = path.join(viewerDir, 'i18n');
  if (fs.existsSync(catalogDir)) {
    fs.readdirSync(catalogDir)
      .filter((name) => name.endsWith('.js'))
      .sort()
      .forEach((name) => parts.push(path.join(catalogDir, name)));
  }
  return parts.map(readText).join('\n');
}

module.exports = {
  readViewerCss,
  readViewerI18n
};

