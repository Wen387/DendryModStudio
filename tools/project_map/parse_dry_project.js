#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dryParser = require('dendrynexus/lib/parsers/dry');
const sceneParser = require('dendrynexus/lib/parsers/scene');

const ROUTE_FIELDS = [
  'goTo',
  'goToRef',
  'goSub',
  'goSubStart',
  'goSubEnd'
];

const SINGLE_ROUTE_FIELDS = [
  'checkSuccessGoTo',
  'checkFailureGoTo',
  'call',
  'setJump'
];

const OPTION_FIELDS = [
  'title',
  'subtitle',
  'unavailableSubtitle',
  'viewIf',
  'chooseIf',
  'order',
  'priority',
  'frequency',
  'frequencyVar'
];

const SECTION_FIELDS = [
  'title',
  'subtitle',
  'viewIf',
  'chooseIf',
  'order',
  'priority',
  'frequency',
  'frequencyVar',
  'tags',
  'signal',
  'style',
  'maxVisits',
  'countVisitsMax',
  'maxVisitsVar',
  'newPage',
  'setRoot',
  'isSpecial',
  'isDeck',
  'isPinnedCard',
  'isCard',
  'isHand',
  'minChoices',
  'maxChoices',
  'gameOver'
];

const POST_EVENT_REL = 'source/scenes/post_event.scene.dry';

function usage() {
  return [
    'Usage: node tools/project_map/parse_dry_project.js [--root <path>]',
    '',
    'Scans source/**/*.scene.dry under root and writes JSON to stdout.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {root: '.'};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      i += 1;
      if (i >= argv.length) {
        throw new Error('--root requires a path');
      }
      args.root = argv[i];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }
  return args;
}

function toPosixPath(value) {
  return String(value).replace(/\\/g, '/').split(path.sep).join('/');
}

function parserFilename(root, filename) {
  return toPosixPath(path.relative(root, filename));
}

function sourceDir(root) {
  return path.join(root, 'source');
}

function listSceneFiles(root) {
  const start = sourceDir(root);
  const files = [];

  function visit(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        return;
      }
      throw err;
    }

    entries
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.scene.dry')) {
          files.push(fullPath);
        }
      });
  }

  visit(start);
  return files.sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

function parseDry(filename, content) {
  return new Promise((resolve, reject) => {
    dryParser.parseFromContent(filename, content, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function parseScene(filename, content) {
  return new Promise((resolve, reject) => {
    sceneParser.parseFromContent(filename, content, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function extractErrorLine(err) {
  if (err && Number.isInteger(err.line)) {
    return err.line;
  }
  const match = String(err && err.message ? err.message : err).match(/\bline\s+(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function diagnostic(filePath, phase, err) {
  return {
    severity: 'error',
    phase,
    path: filePath,
    line: extractErrorLine(err),
    message: String(err && err.message ? err.message : err)
  };
}

function metadataOf(object) {
  const metadata = object && object.$metadata ? object.$metadata : {};
  const out = {};
  Object.keys(metadata).sort().forEach((key) => {
    const value = metadata[key];
    if (value && typeof value === 'object') {
      out[key] = {
        path: value.$file || undefined,
        line: Number.isInteger(value.$line) ? value.$line : undefined
      };
    } else {
      out[key] = value;
    }
  });
  return out;
}

function propertyLine(object, propertyName) {
  if (!object || !object.$metadata) {
    return null;
  }
  const prop = object.$metadata[propertyName];
  if (prop && Number.isInteger(prop.$line) && prop.$line >= 0) {
    return prop.$line;
  }
  if (Number.isInteger(object.$metadata.$line) && object.$metadata.$line >= 0) {
    return object.$metadata.$line;
  }
  return null;
}

function sourceSpan(object, fallbackStart, fallbackEnd) {
  const start = propertyLine(object, '$line') || (
    object && object.$metadata && Number.isInteger(object.$metadata.$line) &&
    object.$metadata.$line >= 0 ? object.$metadata.$line : fallbackStart
  );
  return {
    startLine: start || fallbackStart || null,
    endLine: fallbackEnd || start || fallbackStart || null
  };
}

function ownDefined(object, names) {
  const out = {};
  names.forEach((name) => {
    if (object && object[name] !== undefined) {
      out[name] = object[name];
    }
  });
  return out;
}

function endsInMagic(startsInMagic, text) {
  const lastStart = text.lastIndexOf('{!');
  const lastEnd = text.lastIndexOf('!}');
  if (lastEnd > lastStart) {
    return false;
  }
  if (lastStart > lastEnd) {
    return true;
  }
  return startsInMagic;
}

function splitRouteClauses(value) {
  if (typeof value !== 'string') {
    return [];
  }
  const chunks = [];
  let inMagic = false;
  value.split(/\s*;\s*/).forEach((chunk) => {
    if (inMagic && chunks.length > 0) {
      chunks[chunks.length - 1] = chunks[chunks.length - 1] + ';' + chunk;
    } else {
      chunks.push(chunk);
    }
    inMagic = endsInMagic(inMagic, chunk);
  });
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

function parseRouteField(value) {
  return splitRouteClauses(value).map((clause) => {
    const parts = clause.split(/\s+if\s+/, 2);
    const route = {
      id: parts[0].trim(),
      raw: clause
    };
    if (parts.length === 2) {
      route.predicate = parts[1].trim();
    }
    return route;
  });
}

function routeFields(object) {
  const routes = {};
  ROUTE_FIELDS.forEach((field) => {
    if (object && object[field] !== undefined) {
      routes[field] = parseRouteField(object[field]);
    }
  });
  SINGLE_ROUTE_FIELDS.forEach((field) => {
    if (object && object[field] !== undefined) {
      routes[field] = [{id: String(object[field]).trim(), raw: String(object[field]).trim()}];
    }
  });
  return routes;
}

function optionTarget(id) {
  if (typeof id !== 'string') {
    return null;
  }
  if (id.startsWith('@')) {
    return {kind: 'scene', id: id.slice(1)};
  }
  if (id.startsWith('#')) {
    return {kind: 'tag', id: id.slice(1)};
  }
  return {kind: 'scene', id};
}

function normalizeOption(option) {
  return Object.assign({
    id: option.id,
    target: optionTarget(option.id),
    sourceSpan: sourceSpan(option, null, null),
    metadata: metadataOf(option)
  }, ownDefined(option, OPTION_FIELDS));
}

function normalizeSection(section, nextStartLine, fileLineCount) {
  const startLine = section && section.$metadata && Number.isInteger(section.$metadata.$line) ?
    section.$metadata.$line : null;
  const endLine = nextStartLine ? nextStartLine - 1 : fileLineCount;
  const out = Object.assign({
    id: section.id,
    sourceSpan: sourceSpan(section, startLine, endLine),
    metadata: metadataOf(section),
    routes: routeFields(section),
    options: (section.options || []).map(normalizeOption)
  }, ownDefined(section, SECTION_FIELDS));
  return out;
}

function normalizeScene(rawDry, relativePath, fileLineCount) {
  const sectionStarts = (rawDry.sections || []).map((section) => {
    return section.$metadata && Number.isInteger(section.$metadata.$line) ?
      section.$metadata.$line : null;
  });
  const firstSectionStart = sectionStarts.find((line) => line !== null);
  const topEnd = firstSectionStart ? firstSectionStart - 1 : fileLineCount;

  return Object.assign({
    id: rawDry.id,
    title: rawDry.title || '',
    path: relativePath,
    sourceSpan: sourceSpan(rawDry, 1, fileLineCount),
    topLevelSpan: sourceSpan(rawDry, 1, topEnd),
    metadata: metadataOf(rawDry),
    routes: routeFields(rawDry),
    options: (rawDry.options || []).map(normalizeOption),
    sections: (rawDry.sections || []).map((section, index) => {
      return normalizeSection(section, sectionStarts[index + 1], fileLineCount);
    })
  }, ownDefined(rawDry, SECTION_FIELDS));
}

async function parseProject(rootArg) {
  const root = path.resolve(rootArg);
  const scenes = [];
  const diagnostics = [];
  const files = listSceneFiles(root);

  for (const filename of files) {
    const relativePath = parserFilename(root, filename);
    if (relativePath === POST_EVENT_REL) {
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(filename, 'utf8');
    } catch (err) {
      diagnostics.push(diagnostic(relativePath, 'read', err));
      continue;
    }

    const lineCount = content.split(/\n/).length;
    let rawDry;
    try {
      rawDry = await parseDry(relativePath, content);
    } catch (err) {
      diagnostics.push(diagnostic(relativePath, 'dry', err));
      continue;
    }

    try {
      await parseScene(relativePath, content);
    } catch (err) {
      diagnostics.push(diagnostic(relativePath, 'scene', err));
    }

    scenes.push(normalizeScene(rawDry, relativePath, lineCount));
  }

  return {
    root,
    sourceGlob: 'source/**/*.scene.dry',
    sceneCount: scenes.length,
    diagnosticCount: diagnostics.length,
    scenes,
    diagnostics
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(String(err.message || err) + '\n\n' + usage() + '\n');
    process.exitCode = 2;
    return;
  }

  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }

  const result = await parseProject(args.root);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.diagnosticCount > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  parseProject,
  parseArgs,
  listSceneFiles,
  parserFilename,
  toPosixPath
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exitCode = 1;
  });
}
