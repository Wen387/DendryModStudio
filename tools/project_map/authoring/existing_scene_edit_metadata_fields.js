(function initProjectMapExistingSceneEditMetadataFields(global) {
  'use strict';

  const EDITABLE_DEFINITIONS = [
    {
      key: 'title',
      role: 'title',
      label: 'Title',
      reason: 'Exact source line for the scene title can be checked before replacement.'
    },
    {
      key: 'subtitle',
      role: 'subtitle',
      label: 'Subtitle',
      reason: 'Exact source line for the scene subtitle can be checked before replacement.'
    },
    {
      key: 'viewIf',
      role: 'condition',
      label: 'Appearance condition',
      reason: 'Exact source line for the scene view-if can be checked before replacement.'
    },
    {
      key: 'chooseIf',
      role: 'condition',
      label: 'Choice condition',
      reason: 'Exact source line for the scene choose-if can be checked before replacement.'
    },
    {
      key: 'tags',
      role: 'metadata',
      label: 'Tags',
      reason: 'Exact source line for the scene tags can be checked before replacement.'
    },
    {
      key: 'priority',
      role: 'metadata',
      label: 'Priority',
      reason: 'Exact source line for the scene priority can be checked before replacement.'
    },
    {
      key: 'frequency',
      role: 'metadata',
      label: 'Frequency',
      reason: 'Exact source line for the scene frequency can be checked before replacement.'
    },
    {
      key: 'frequencyVar',
      role: 'metadata',
      label: 'Frequency variable',
      reason: 'Exact source line for the scene frequency variable can be checked before replacement.'
    },
    {
      key: 'maxVisits',
      role: 'metadata',
      label: 'Max visits',
      reason: 'Exact source line for the scene max visits can be checked before replacement.'
    },
    {
      key: 'maxVisitsVar',
      role: 'metadata',
      label: 'Max visits variable',
      reason: 'Exact source line for the scene max visits variable can be checked before replacement.'
    },
    {
      key: 'newPage',
      role: 'metadata',
      label: 'New page',
      reason: 'Exact source line for the scene new-page flag can be checked before replacement.'
    },
    {
      key: 'setRoot',
      role: 'metadata',
      label: 'Set root',
      reason: 'Exact source line for the scene set-root value can be checked before replacement.'
    },
    {
      key: 'gameOver',
      role: 'metadata',
      label: 'Game over',
      reason: 'Exact source line for the scene game-over flag can be checked before replacement.'
    }
  ];

  const SECTION_METADATA_KEYS = new Set([
    'viewIf',
    'chooseIf',
    'priority',
    'frequency',
    'frequencyVar',
    'maxVisits',
    'maxVisitsVar',
    'newPage',
    'setRoot',
    'gameOver'
  ]);

  function cloneDefinition(definition) {
    return Object.assign({}, definition);
  }

  function editableDefinitions() {
    return EDITABLE_DEFINITIONS.map(cloneDefinition);
  }

  function sectionEditableDefinitions() {
    return EDITABLE_DEFINITIONS
      .filter((definition) => SECTION_METADATA_KEYS.has(definition.key))
      .map(cloneDefinition);
  }

  function isSectionMetadataKey(key) {
    return SECTION_METADATA_KEYS.has(String(key || ''));
  }

  const api = {
    editableDefinitions,
    sectionEditableDefinitions,
    isSectionMetadataKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneEditMetadataFields = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
