'use strict';

const base = require('../package.json').build;

function fileSet(from, to, filter) {
  return filter ? {from, to, filter} : {from, to};
}

module.exports = {
  ...base,
  compression: 'store',
  asar: true,
  artifactName: 'DendryModStudio-${os}-${arch}-shell-only.${ext}',
  directories: {
    ...base.directories,
    output: 'dist-builder/shell-only'
  },
  files: [
    ...base.files,
    fileSet('../viewer/index.html', 'project_map/viewer/index.html'),
    fileSet('../authoring', 'project_map/authoring', [
      'install_plan.js',
      'runtime_lens_model.js',
      'runtime_preview_debug_model.js',
      'variable_suggestions.js'
    ])
  ],
  extraResources: [],
  win: {
    ...base.win,
    artifactName: 'DendryModStudio-win-x64-shell-only.${ext}'
  },
  nsis: {
    ...base.nsis
  }
};
