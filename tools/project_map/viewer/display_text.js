(function initProjectMapDisplayText(global) {
  'use strict';

  // Display-boundary text helpers shared by read-only surfaces (Explore lists
  // and inspector, storyboard identity facts, object editor field labels, card
  // face previews):
  //   1. stripInlineMarkup -- mod prose carries raw inline HTML such as
  //      <span style="color: #c00000;">. Editable textareas must keep it
  //      byte-exact, but list rows, titles, and labels are display-only, so the
  //      tags are stripped there (text content kept) before escaping.
  //   2. fieldLabel / identityLabel / sortFieldLabel -- several model layers
  //      emit fixed ENGLISH display labels (object_field_presentation_model,
  //      existing_scene_edit_metadata_fields, content_storyboard_model
  //      buildEditor, explore VIEW_DEFS sort field names). The model output is
  //      contract data and stays untouched; these maps translate the known
  //      label strings at the render boundary only, falling back to the
  //      original text for anything unknown.
  // Off-budget sibling (mirrors object_editor_find): pure functions, no DOM,
  // no model mutation; surfaces wire it with single-line calls.

  // Known inline presentation tags seen in real mod prose. A whitelist keeps
  // literal text like "x < 3" intact -- only these tag forms are removed.
  const INLINE_TAG_RE = /<\/?(?:span|b|i|em|strong|u|br|font)\b[^>]*>/gi;

  function stripInlineMarkup(text) {
    return String(text == null ? '' : text).replace(INLINE_TAG_RE, '');
  }

  // Model-layer English field labels -> i18n keys. Two reuse existing catalog
  // entries; the rest are new displayText.fieldLabel.* keys.
  const FIELD_LABELS = {
    'Choice condition': ['displayText.fieldLabel.choiceCondition', 'Choice condition'],
    'Choice availability': ['displayText.fieldLabel.choiceAvailability', 'Choice availability'],
    'Appearance condition': ['displayText.fieldLabel.appearanceCondition', 'Appearance condition'],
    'Condition': ['displayText.fieldLabel.condition', 'Condition'],
    'Route target': ['previewObjectEditor.routeTarget', 'Route target'],
    'Route condition': ['displayText.fieldLabel.routeCondition', 'Route condition'],
    'Call scene': ['displayText.fieldLabel.callScene', 'Call scene'],
    'Return target': ['displayText.fieldLabel.returnTarget', 'Return target'],
    'Advanced route source': ['displayText.fieldLabel.advancedRouteSource', 'Advanced route source'],
    'Advanced source': ['displayText.fieldLabel.advancedSource', 'Advanced source'],
    'Player option': ['displayText.fieldLabel.playerOption', 'Player option'],
    'Option result': ['displayText.fieldLabel.optionResult', 'Option result'],
    'Conditional body': ['displayText.fieldLabel.conditionalBody', 'Conditional body'],
    'Unavailable text': ['previewObjectEditor.unavailableText', 'Unavailable text'],
    'Tags': ['displayText.fieldLabel.tags', 'Tags'],
    'Priority': ['displayText.fieldLabel.priority', 'Priority'],
    'New choice state change': ['displayText.fieldLabel.newChoiceStateChange', 'New choice state change'],
    'New opening state change': ['displayText.fieldLabel.newOpeningStateChange', 'New opening state change'],
    'Title': ['create.field.title', 'Title'],
    'Subtitle': ['eventWorkbench.role.subtitle', 'Subtitle'],
    'Option subtitle': ['eventWorkbench.role.option_subtitle', 'Option subtitle'],
    'Max visits': ['create.field.maxVisits', 'Max visits'],
    'New page': ['displayText.fieldLabel.newPage', 'New page'],
    'Opening page text': ['displayText.fieldLabel.openingPageText', 'Opening page text']
  };

  function fieldLabel(label) {
    const text = stripInlineMarkup(label).trim();
    // Effect rows carry a dynamic suffix ("Effect: Q.some_variable");
    // translate the fixed prefix and keep the variable verbatim.
    if (text.indexOf('Effect: ') === 0) {
      return t('displayText.fieldLabel.effectPrefix', 'Effect') + ': ' + text.slice(8);
    }
    const entry = FIELD_LABELS[text];
    return entry ? t(entry[0], entry[1]) : text;
  }

  // content_storyboard_model buildEditor identity row labels.
  const IDENTITY_LABELS = {
    'ID': ['displayText.identity.id', 'ID'],
    'Kind': ['existingScene.kind', 'Kind'],
    'Timeline': ['storyboard.timeline', 'Timeline'],
    'Profile': ['displayText.identity.profile', 'Profile'],
    'Source': ['existingScene.source', 'Source']
  };

  function identityLabel(label) {
    const entry = IDENTITY_LABELS[String(label == null ? '' : label)];
    return entry ? t(entry[0], entry[1]) : String(label == null ? '' : label);
  }

  // Explore sort <option> labels for the common VIEW_DEFS sort field names.
  // The option VALUE stays the raw field name; only the visible text maps.
  const SORT_FIELDS = ['text', 'role', 'path', 'line', 'confidence', 'editability', 'id', 'title'];

  function sortFieldLabel(field) {
    const name = String(field == null ? '' : field);
    return SORT_FIELDS.includes(name)
      ? t('explore.sort.' + name, name)
      : name;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {stripInlineMarkup, fieldLabel, identityLabel, sortFieldLabel};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapDisplayText = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
