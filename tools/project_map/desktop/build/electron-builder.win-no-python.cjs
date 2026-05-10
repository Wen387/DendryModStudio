'use strict';

const fastInstall = require('./electron-builder.win-fast-install.cjs');

module.exports = {
  ...fastInstall,
  artifactName: 'DendryModStudio-${os}-${arch}-no-python.${ext}',
  directories: {
    ...fastInstall.directories,
    output: 'dist-builder/no-python'
  },
  extraResources: fastInstall.extraResources.map((entry) => {
    if (entry.from !== 'runtime') {
      return entry;
    }
    return {
      from: 'runtime',
      to: 'app/runtime',
      filter: [
        'README.md'
      ]
    };
  }),
  win: {
    ...fastInstall.win,
    artifactName: 'DendryModStudio-win-x64-no-python.${ext}'
  }
};
