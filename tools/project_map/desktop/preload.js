'use strict';

const {contextBridge, ipcRenderer} = require('electron');

function encodeFileUrlSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => {
    return '%' + char.charCodeAt(0).toString(16).toUpperCase();
  });
}

function encodeFileUrlPath(pathname) {
  return pathname.split('/').map((segment, index) => {
    if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
      return segment;
    }
    return encodeFileUrlSegment(segment);
  }).join('/');
}

function fileUrlFromPath(value) {
  const root = String(value || '').trim();
  if (!root) {
    return '';
  }
  if (/^file:/i.test(root)) {
    return root;
  }
  const normalized = root.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) {
    return 'file:///' + encodeFileUrlPath(normalized);
  }
  if (normalized.startsWith('//')) {
    const parts = normalized.replace(/^\/+/, '').split('/');
    const host = encodeFileUrlSegment(parts.shift() || '');
    const rest = encodeFileUrlPath(parts.join('/'));
    return 'file://' + host + (rest ? '/' + rest : '');
  }
  if (normalized.startsWith('/')) {
    return 'file://' + encodeFileUrlPath(normalized);
  }
  return 'file:///' + encodeFileUrlPath(normalized);
}

function assetBaseUrlForRoot(root) {
  if (!root) {
    return '';
  }
  return fileUrlFromPath(root);
}

function dispatchIndexLoaded(result) {
  if (!result || !result.ok || !result.index) {
    return;
  }
  window.dispatchEvent(new CustomEvent('ProjectMap:desktop-index-loaded', {
    detail: {
      index: result.index,
      fileInfo: {
        name: result.indexPath || 'desktop ProjectIndex',
        size: JSON.stringify(result.index).length
      },
      root: result.root,
      projectName: result.projectName,
      indexPath: result.indexPath,
      assetBaseUrl: assetBaseUrlForRoot(result.root),
      includeExcerpts: result.includeExcerpts,
      summary: result.summary
    }
  }));
}

ipcRenderer.on('dendry:scan-progress', (_event, update) => {
  window.dispatchEvent(new CustomEvent('ProjectMap:desktop-scan-progress', {
    detail: update || {}
  }));
});

contextBridge.exposeInMainWorld('dendryDesktop', {
  isDesktop: true,
  getState: () => ipcRenderer.invoke('dendry:desktop-state'),
  doctor: (options) => ipcRenderer.invoke('dendry:doctor', options || {}),
  openProject: async (options) => {
    const result = await ipcRenderer.invoke('dendry:open-project', options || {});
    dispatchIndexLoaded(result);
    return result;
  },
  openStarterDemo: async (options) => {
    const result = await ipcRenderer.invoke('dendry:open-starter-demo', options || {});
    dispatchIndexLoaded(result);
    return result;
  },
  scanProject: async (options) => {
    const result = await ipcRenderer.invoke('dendry:scan-project', options || {});
    dispatchIndexLoaded(result);
    return result;
  },
  applyInstallPlan: (options) => ipcRenderer.invoke('dendry:install-plan-apply', options || {}),
  createRuntimePreview: (options) => ipcRenderer.invoke('dendry:runtime-preview-create', options || {}),
  recordRuntimePreviewHistory: (options) => ipcRenderer.invoke('dendry:runtime-preview-history', options || {}),
  checkUpdateNotice: (options) => ipcRenderer.invoke('dendry:update-notice-check', options || {}),
  openExternalUrl: (options) => ipcRenderer.invoke('dendry:open-external-url', options || {})
});
