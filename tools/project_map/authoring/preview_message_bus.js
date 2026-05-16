(function initProjectMapPreviewMessageBus(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ProjectMapPreviewMessageBus = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function buildProjectMapPreviewMessageBus() {
  'use strict';

  const MESSAGE_KINDS = Object.freeze({
    RUNTIME_PREVIEW_COMMAND: 'dms-runtime-preview-command',
    RUNTIME_PREVIEW_RESULT: 'dms-runtime-preview-result',
    RUNTIME_LENS_ACTION: 'dms-runtime-lens-action',
    RUNTIME_LENS_SESSION_EVIDENCE: 'dms-runtime-lens-session-evidence'
  });

  function buildRuntimeLensAction(action, extra) {
    const payload = {
      kind: MESSAGE_KINDS.RUNTIME_LENS_ACTION,
      action: String(action || '')
    };
    if (payload.action === 'reset') {
      return payload;
    }
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach((key) => {
        if (key !== 'kind' && key !== 'action') {
          payload[key] = extra[key];
        }
      });
    }
    return payload;
  }

  function isRuntimeLensSessionEvidenceMessage(message, activeSession) {
    if (!message || typeof message !== 'object' || message.kind !== MESSAGE_KINDS.RUNTIME_LENS_SESSION_EVIDENCE) {
      return false;
    }
    const activeSessionId = activeSession && activeSession.sessionId;
    const messageSessionId = message.sessionId;
    if (activeSessionId !== undefined && activeSessionId !== null && String(activeSessionId) &&
        messageSessionId !== undefined && messageSessionId !== null && String(messageSessionId) &&
        String(messageSessionId) !== String(activeSessionId)) {
      return false;
    }
    return true;
  }

  function getPostMessageTargetOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '*';
    }
    try {
      const url = new URL(raw);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : '*';
    } catch (_err) {
      return '*';
    }
  }

  return {
    MESSAGE_KINDS,
    buildRuntimeLensAction,
    isRuntimeLensSessionEvidenceMessage,
    getPostMessageTargetOrigin
  };
});
