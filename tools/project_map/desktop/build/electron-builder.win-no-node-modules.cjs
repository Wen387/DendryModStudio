'use strict';

const noPython = require('./electron-builder.win-no-python.cjs');

module.exports = {
  ...noPython,
  artifactName: 'DendryModStudio-${os}-${arch}-no-node-modules.${ext}',
  directories: {
    ...noPython.directories,
    output: 'dist-builder/no-node-modules'
  },
  extraResources: noPython.extraResources.filter((entry) => entry.from !== '../../../node_modules'),
  win: {
    ...noPython.win,
    artifactName: 'DendryModStudio-win-x64-no-node-modules.${ext}'
  }
};
