(function initProjectMapCardBoardInteractions(global) {
  'use strict';

  const MIME = 'application/x-dms-card-board';

  function bind(root, options) {
    const host = root || null;
    const callbacks = options || {};
    if (!host) {
      return;
    }
    bindCards(host, callbacks);
    bindFilters(host, callbacks);
    bindDrops(host, callbacks);
    bindCreate(host, callbacks);
  }

  function bindCards(host, callbacks) {
    host.querySelectorAll('[data-card-board-card]').forEach((card) => {
      if (card.dataset.cardBoardBound === 'true') {
        return;
      }
      card.dataset.cardBoardBound = 'true';
      card.addEventListener('click', () => callbacks.onSelect && callbacks.onSelect(card.dataset.cardBoardCard || ''));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          callbacks.onSelect && callbacks.onSelect(card.dataset.cardBoardCard || '');
        }
      });
      card.addEventListener('dragstart', (event) => {
        const payload = {
          key: card.dataset.cardBoardCard || '',
          kind: card.dataset.cardBoardCardKind || '',
          title: card.dataset.cardBoardCardTitle || ''
        };
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData(MIME, JSON.stringify(payload));
        event.dataTransfer.setData('text/plain', payload.key);
      });
    });
  }

  function bindFilters(host, callbacks) {
    const query = host.querySelector('[data-card-board-query]');
    if (query && query.dataset.cardBoardQueryBound !== 'true') {
      query.dataset.cardBoardQueryBound = 'true';
      query.addEventListener('input', () => callbacks.onQuery && callbacks.onQuery(query.value || ''));
    }
    host.querySelectorAll('[data-card-board-type]').forEach((button) => {
      if (button.dataset.cardBoardTypeBound === 'true') {
        return;
      }
      button.dataset.cardBoardTypeBound = 'true';
      button.addEventListener('click', () => callbacks.onType && callbacks.onType(button.dataset.cardBoardType || 'all'));
    });
  }

  function bindDrops(host, callbacks) {
    host.querySelectorAll('[data-card-board-drop-target]').forEach((target) => {
      if (target.dataset.cardBoardDropBound === 'true') {
        return;
      }
      target.dataset.cardBoardDropBound = 'true';
      target.addEventListener('dragover', (event) => {
        if (!hasCardPayload(event)) {
          return;
        }
        event.preventDefault();
        target.classList.add('is-card-drop-target');
      });
      target.addEventListener('dragleave', () => target.classList.remove('is-card-drop-target'));
      target.addEventListener('drop', (event) => {
        if (!hasCardPayload(event)) {
          return;
        }
        event.preventDefault();
        target.classList.remove('is-card-drop-target');
        callbacks.onDrop && callbacks.onDrop(readPayload(event), target);
      });
    });
  }

  function bindCreate(host, callbacks) {
    host.querySelectorAll('[data-card-board-create-lane]').forEach((button) => {
      if (button.dataset.cardBoardCreateBound === 'true') {
        return;
      }
      button.dataset.cardBoardCreateBound = 'true';
      button.addEventListener('click', () => callbacks.onCreate && callbacks.onCreate(button));
    });
  }

  function hasCardPayload(event) {
    const types = event && event.dataTransfer && event.dataTransfer.types;
    return types && Array.from(types).includes(MIME);
  }

  function readPayload(event) {
    try {
      return JSON.parse(event.dataTransfer.getData(MIME) || '{}');
    } catch (_err) {
      return {};
    }
  }

  const api = {bind};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardBoardInteractions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
