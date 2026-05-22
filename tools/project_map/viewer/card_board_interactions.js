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
    bindObjectSelection(host, callbacks);
    bindActions(host, callbacks);
  }

  function bindCards(host, callbacks) {
    host.querySelectorAll('[data-card-board-card]').forEach((card) => {
      if (card.dataset.cardBoardBound === 'true') {
        return;
      }
      card.dataset.cardBoardBound = 'true';
      card.addEventListener('click', (event) => {
        if (isNestedInteractive(event.target, card)) {
          return;
        }
        callbacks.onSelect && callbacks.onSelect(card.dataset.cardBoardCard || '');
      });
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) {
          return;
        }
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
      if (button.dataset.cardBoardAction) {
        return;
      }
      if (button.dataset.cardBoardCreateBound === 'true') {
        return;
      }
      button.dataset.cardBoardCreateBound = 'true';
      button.addEventListener('click', () => callbacks.onCreate && callbacks.onCreate(button));
    });
  }

  function bindObjectSelection(host, callbacks) {
    host.querySelectorAll('[data-card-board-lane-select]').forEach((header) => {
      if (header.dataset.cardBoardLaneSelectBound === 'true') {
        return;
      }
      header.dataset.cardBoardLaneSelectBound = 'true';
      const select = () => callbacks.onObjectSelect && callbacks.onObjectSelect({
        kind: 'lane',
        key: 'lane:' + (header.dataset.cardBoardLaneSelect || ''),
        laneKey: header.dataset.cardBoardLaneSelect || ''
      });
      header.addEventListener('click', select);
      header.addEventListener('keydown', (event) => runOnConfirmKey(event, select));
    });
    host.querySelectorAll('[data-card-board-hand-route]').forEach((route) => {
      if (route.dataset.cardBoardHandRouteBound === 'true') {
        return;
      }
      route.dataset.cardBoardHandRouteBound = 'true';
      const select = () => {
        if (route.dataset.cardBoardOpenLaneObject === 'deck_pool' && route.dataset.cardBoardDeckPool) {
          callbacks.onAction && callbacks.onAction('open_deck_pool_editor', route);
          return;
        }
        callbacks.onObjectSelect && callbacks.onObjectSelect({
          kind: 'route',
          key: route.dataset.cardBoardHandRoute || '',
          laneKey: 'hand'
        });
      };
      route.addEventListener('click', select);
      route.addEventListener('keydown', (event) => runOnConfirmKey(event, select));
    });
    host.querySelectorAll('[data-card-board-option]').forEach((option) => {
      if (option.dataset.cardBoardOptionBound === 'true') {
        return;
      }
      option.dataset.cardBoardOptionBound = 'true';
      const select = () => callbacks.onObjectSelect && callbacks.onObjectSelect({
        kind: 'option',
        key: option.dataset.cardBoardOption || '',
        cardKey: option.dataset.cardBoardOptionCard || '',
        optionIndex: Number(option.dataset.cardBoardOptionIndex || 0),
        optionId: option.dataset.cardBoardOptionId || '',
        fieldId: option.dataset.cardBoardOptionField || '',
        optionPath: option.dataset.cardBoardOptionPath || '',
        sectionId: option.dataset.cardBoardOptionSection || ''
      });
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        select();
      });
      option.addEventListener('keydown', (event) => {
        event.stopPropagation();
        runOnConfirmKey(event, select);
      });
    });
    host.querySelectorAll('[data-card-board-intent]').forEach((intent) => {
      if (intent.dataset.cardBoardIntentBound === 'true') {
        return;
      }
      intent.dataset.cardBoardIntentBound = 'true';
      const select = () => callbacks.onObjectSelect && callbacks.onObjectSelect({
        kind: 'intent',
        key: intent.dataset.cardBoardIntent || 'intent'
      });
      intent.addEventListener('click', select);
      intent.addEventListener('keydown', (event) => runOnConfirmKey(event, select));
    });
  }

  function bindActions(host, callbacks) {
    host.querySelectorAll('[data-card-board-action]').forEach((button) => {
      if (button.dataset.cardBoardActionBound === 'true') {
        return;
      }
      button.dataset.cardBoardActionBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        callbacks.onAction && callbacks.onAction(button.dataset.cardBoardAction || '', button);
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        callbacks.onAction && callbacks.onAction(button.dataset.cardBoardAction || '', button);
      });
    });
  }

  function runOnConfirmKey(event, callback) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    callback();
  }

  function isNestedInteractive(target, root) {
    if (!target || target === root || !target.closest) {
      return false;
    }
    const interactive = target.closest('button, input, select, textarea, a, [data-card-board-action], [data-card-board-option]');
    return Boolean(interactive && root.contains(interactive));
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
