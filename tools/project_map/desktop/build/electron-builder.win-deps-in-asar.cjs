'use strict';

const fastInstall = require('./electron-builder.win-fast-install.cjs');

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
  ...fastInstall,
  artifactName: 'DendryModStudio-${os}-${arch}-deps-in-asar.${ext}',
  directories: {
    ...fastInstall.directories,
    output: 'dist-builder/deps-in-asar'
  },
  files: [
    ...fastInstall.files,
    fileSet('../../../node_modules', 'node_modules', trimFilter)
  ],
  extraResources: fastInstall.extraResources.filter((entry) => entry.from !== '../../../node_modules'),
  win: {
    ...fastInstall.win,
    artifactName: 'DendryModStudio-win-x64-deps-in-asar.${ext}'
  }
};
