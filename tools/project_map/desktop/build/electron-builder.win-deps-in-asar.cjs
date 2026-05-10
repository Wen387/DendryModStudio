'use strict';

const base = require('../package.json').build;

module.exports = {
  ...base,
  artifactName: 'DendryModStudio-${os}-${arch}-deps-in-asar.${ext}',
  directories: {
    ...base.directories,
    output: 'dist-builder/deps-in-asar'
  },
  win: {
    ...base.win,
    artifactName: 'DendryModStudio-win-x64-deps-in-asar.${ext}'
  }
};
