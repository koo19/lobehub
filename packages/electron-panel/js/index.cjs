/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const path = require('node:path');

function loadNative() {
  if (process.platform !== 'darwin') return null;

  try {
    const gypBuild = require('node-gyp-build');
    return gypBuild(path.join(__dirname, '..'));
  } catch {
    try {
      return require('../build/Release/electron_panel.node');
    } catch {
      console.warn(
        '[@lobechat/electron-panel] Failed to load native addon — panel features disabled.',
      );
      return null;
    }
  }
}

const native = loadNative();

class Panel {
  constructor(handle) {
    if (!Buffer.isBuffer(handle)) {
      throw new Error('[@lobechat/electron-panel] handle must be a Buffer');
    }
    this._addon = native ? new native.Panel(handle) : null;
  }

  panelize() {
    return this._addon ? this._addon.panelize() : false;
  }

  enableNativeDrag(rect) {
    return this._addon ? this._addon.enableNativeDrag(rect) : false;
  }

  disableNativeDrag() {
    return this._addon ? this._addon.disableNativeDrag() : false;
  }

  animateResize(frame, duration) {
    if (duration === undefined) duration = 0.2;
    return this._addon ? this._addon.animateResize(frame, duration) : false;
  }

  animateResizeElectron(frame, duration) {
    if (duration === undefined) duration = 0.2;
    return this._addon ? this._addon.animateResizeElectron(frame, duration) : false;
  }
}

module.exports = { Panel };
