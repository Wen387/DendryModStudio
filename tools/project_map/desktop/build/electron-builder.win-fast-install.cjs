'use strict';

const base = require('../package.json').build;

module.exports = {
  ...base,
  compression: 'store',
  artifactName: 'DendryModStudio-${os}-${arch}-fast-install.${ext}',
  directories: {
    ...base.directories,
    output: 'dist-builder/fast-install'
  },
  win: {
    ...base.win,
    artifactName: 'DendryModStudio-win-x64-fast-install.${ext}'
  },
  nsis: {
    ...base.nsis
  }
};
