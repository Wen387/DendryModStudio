'use strict';
// P3 build adoption for the System UI right-sidebar guarded auto-apply. Decides
// whether the make-html preview build should adopt a mod-owned template via
// `-t <dir>`, kept out of runtime_preview.js so that orchestrator stays within
// its complexity budget.
const fs = require('fs');
const path = require('path');

// Derive the mod template dir from the plan's template operations (the eject /
// panel-insert target), falling back to the indexer's owned template evidence.
function dirFromPlan(plan, projectIndex) {
  const operations = (plan && plan.operations) || [];
  for (const operation of operations) {
    const relPath = String(operation && operation.path || '').replace(/\\/g, '/');
    const match = /^(templates\/html\/[^/]+)\/\+index\.html$/.exec(relPath);
    if (match && (operation.type === 'insert_html_block' || operation.type === 'copy_template_file')) {
      return match[1];
    }
  }
  const source = projectIndex && projectIndex.project && projectIndex.project.templateSource;
  if (source && source.owned && Array.isArray(source.dirs) && source.dirs[0]) {
    return String(source.dirs[0]);
  }
  return '';
}

// Only adopt the mod template when it actually exists in this build root. The
// modified lane has the ejected/inserted template (so the panel renders); an
// engine_default baseline lane has none, so this returns '' and make-html uses
// the bundled default. This is what keeps the guard honest per build lane.
function adoptOption(root, options) {
  const dir = String(options && options.templateDir || '').trim().replace(/\\/g, '/');
  if (!dir || !/^templates\/html\/[^/]+$/.test(dir)) {
    return '';
  }
  return fs.existsSync(path.join(root, dir, '+index.html')) ? dir : '';
}

// make-html args, optionally adopting the mod template via `-t <dir>`.
function makeHtmlArgs(templateOption) {
  const args = ['make-html', '--force'];
  const dir = String(templateOption || '').trim();
  if (dir) {
    args.push('-t', dir);
  }
  return args;
}

module.exports = {dirFromPlan, adoptOption, makeHtmlArgs};
