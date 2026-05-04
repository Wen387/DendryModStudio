'use strict';

function pythonCommand() {
  if (process.env.PYTHON) {
    return process.env.PYTHON;
  }
  return process.platform === 'win32' ? 'py' : 'python3';
}

module.exports = {pythonCommand};
