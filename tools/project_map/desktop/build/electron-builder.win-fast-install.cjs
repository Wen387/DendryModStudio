'use strict';

const base = require('../package.json').build;

const trimFilter = [
  '**/*',
  '!**/.git/**',
  '!**/.github/**',
  '!**/__pycache__/**',
  '!**/*.pyc',
  '!**/coverage/**',
  '!**/doc/**',
  '!**/docs/**',
  '!**/example/**',
  '!**/examples/**',
  '!**/test/**',
  '!**/tests/**',
  '!**/*.map',
  '!**/*.md',
  '!**/*.markdown',
  '!**/.jshint*',
  '!**/.npmignore',
  '!**/package-lock.json'
];

function fileSet(from, to, filter) {
  return filter ? {from, to, filter} : {from, to};
}

module.exports = {
  ...base,
  compression: 'store',
  asar: true,
  artifactName: 'DendryModStudio-${os}-${arch}-fast-install.${ext}',
  directories: {
    ...base.directories,
    output: 'dist-builder/fast-install'
  },
  files: [
    ...base.files,
    fileSet('../viewer', 'project_map/viewer', trimFilter),
    fileSet('../authoring', 'project_map/authoring', trimFilter),
    fileSet('../schema', 'project_map/schema', trimFilter)
  ],
  extraResources: [
    fileSet('../profiles', 'app/project_map/profiles', trimFilter),
    fileSet('../templates', 'app/project_map/templates', trimFilter),
    fileSet('../parse_dry_project.js', 'app/project_map/parse_dry_project.js'),
    fileSet('../build_project_map.py', 'app/project_map/build_project_map.py'),
    fileSet('../indexer', 'app/project_map/indexer', trimFilter),
    fileSet('runtime', 'app/runtime', trimFilter),
    fileSet('../../../node_modules', 'app/node_modules', trimFilter)
  ],
  win: {
    ...base.win,
    artifactName: 'DendryModStudio-win-x64-fast-install.${ext}'
  },
  nsis: {
    ...base.nsis
  }
};
