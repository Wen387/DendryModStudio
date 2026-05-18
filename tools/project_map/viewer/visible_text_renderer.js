(function initProjectMapVisibleTextRenderer(global) {
  'use strict';

  const ALLOWED_TAGS = new Set([
    'span', 'strong', 'b', 'em', 'i', 'u', 'small', 'code', 'mark', 'br', 'sup', 'sub',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'figure', 'figcaption', 'img'
  ]);
  const ALLOWED_STYLE_PROPS = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration']);

  const api = {
    renderInline,
    renderBlocks,
    hasMarkup
  };

  if (global) {
    global.ProjectMapVisibleTextRenderer = api;
  }

  function renderBlocks(value, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const text = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    if (hasVisualBlockMarkup(text)) {
      const html = renderInline(text.replace(/\n+/g, ' '), 0, opts);
      return html
        ? '<div class="dendry-text-rich-block" data-dendry-text-rich-block="true">' + html + '</div>'
        : '';
    }
    const lines = text.split('\n');
    const blocks = [];
    let paragraph = [];

    function flushParagraph() {
      const body = paragraph.join(' ').replace(/\s+/g, ' ').trim();
      paragraph = [];
      if (body) {
        blocks.push('<p>' + renderInline(body, 0, opts) + '</p>');
      }
    }

    lines.forEach((line) => {
      const raw = String(line || '');
      const trimmed = raw.trim();
      if (!trimmed) {
        flushParagraph();
        return;
      }
      const heading = /^(=+)\s+(.+)$/.exec(trimmed);
      if (heading) {
        flushParagraph();
        blocks.push('<h5 class="dendry-text-heading">' + renderInline(heading[2], 0, opts) + '</h5>');
        return;
      }
      if (/^\[\?\s*/.test(trimmed) && /\?\]\s*$/.test(trimmed)) {
        flushParagraph();
        blocks.push('<p class="dendry-text-conditional-line">' + renderInline(trimmed, 0, withConditionalMode(opts, 'block')) + '</p>');
        return;
      }
      paragraph.push(trimmed);
    });
    flushParagraph();

    if (!blocks.length && opts.empty !== false) {
      return '<p class="dendry-text-empty">' + escapeHtml(opts.emptyLabel || '') + '</p>';
    }
    return blocks.join('');
  }

  function renderInline(value, depth, options) {
    const text = String(value == null ? '' : value);
    const opts = isObject(depth) ? depth : (options && typeof options === 'object' ? options : {});
    let html = '';
    let index = 0;
    const nesting = isObject(depth) ? 0 : Number(depth || 0);
    while (index < text.length) {
      if (text.startsWith('![', index)) {
        const image = parseMarkdownImage(text.slice(index), opts);
        if (image) {
          html += image.html;
          index += image.length;
          continue;
        }
      }
      if (text.startsWith('[+', index)) {
        const end = text.indexOf('+]', index + 2);
        if (end > index) {
          html += renderVariableToken(text.slice(index + 2, end));
          index = end + 2;
          continue;
        }
      }
      if (text.startsWith('[?', index)) {
        const end = findConditionalEnd(text, index);
        if (end > index) {
          html += renderConditionalToken(text.slice(index + 2, end), nesting, opts);
          index = end + 2;
          continue;
        }
      }
      if (text.startsWith('**', index)) {
        const end = text.indexOf('**', index + 2);
        if (end > index + 2) {
          html += '<strong>' + renderInline(text.slice(index + 2, end), nesting + 1, opts) + '</strong>';
          index = end + 2;
          continue;
        }
      }
      if (text[index] === '`') {
        const end = text.indexOf('`', index + 1);
        if (end > index) {
          html += '<code>' + escapeHtml(text.slice(index + 1, end)) + '</code>';
          index = end + 1;
          continue;
        }
      }
      if (text[index] === '<') {
        const end = text.indexOf('>', index + 1);
        if (end > index) {
          const rawTag = text.slice(index, end + 1);
          const tag = sanitizeHtmlTag(rawTag, opts) || visualMarkupPlaceholder(rawTag);
          if (tag) {
            html += tag;
            index = end + 1;
            continue;
          }
        }
      }
      const next = nextSpecialIndex(text, index + 1);
      html += escapeHtml(text.slice(index, next)).replace(/&amp;nbsp;/g, '&nbsp;');
      index = next;
    }
    return html;
  }

  function renderVariableToken(raw) {
    const body = String(raw || '').trim();
    const parts = body.split(':');
    const variable = parts.shift().trim();
    const formatter = parts.join(':').trim();
    return [
      '<span class="dendry-text-token dendry-text-variable" data-dendry-token="variable">',
      '<span class="dendry-text-token-kind">[+]</span>',
      '<span class="dendry-text-token-name">' + escapeHtml(variable || body) + '</span>',
      formatter ? '<span class="dendry-text-token-format">' + escapeHtml(formatter) + '</span>' : '',
      '</span>'
    ].join('');
  }

  function renderConditionalToken(raw, depth, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const parsed = parseConditional(raw);
    const nesting = Number(depth || 0);
    const mode = opts.conditionalMode === 'block' && nesting === 0 ? 'block' : 'inline';
    if (mode === 'inline') {
      const body = parsed.body
        ? renderInline(parsed.body, nesting + 1, withConditionalMode(opts, 'inline'))
        : escapeHtml(parsed.condition || String(raw || '').trim());
      const condition = parsed.condition ? ' data-dendry-condition="' + escapeAttr(parsed.condition) + '" title="' + escapeAttr('if ' + parsed.condition) + '"' : '';
      return [
        '<span class="dendry-text-token dendry-text-conditional dendry-text-conditional-inline" data-dendry-token="conditional"' + condition + '>',
        '<span class="dendry-text-conditional-body">' + body + '</span>',
        '</span>'
      ].join('');
    }
    const className = 'dendry-text-token dendry-text-conditional';
    return [
      '<span class="' + className + '" data-dendry-token="conditional">',
      '<span class="dendry-text-token-kind">if</span>',
      parsed.condition ? '<code>' + escapeHtml(parsed.condition) + '</code>' : '',
      parsed.body ? '<span class="dendry-text-conditional-body">' + renderInline(parsed.body, nesting + 1, opts) + '</span>' : '',
      '</span>'
    ].join('');
  }

  function parseConditional(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^\?\s*/, '').replace(/\?\s*$/, '').trim();
    text = text.replace(/^if\s+/i, '').trim();
    const split = splitCondition(text);
    return {
      condition: split.condition,
      body: split.body
    };
  }

  function splitCondition(text) {
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text.startsWith('[?', index)) {
        depth += 1;
        index += 1;
        continue;
      }
      if (text.startsWith('?]', index)) {
        depth = Math.max(0, depth - 1);
        index += 1;
        continue;
      }
      if (text[index] === ':' && depth === 0) {
        return {
          condition: text.slice(0, index).trim(),
          body: text.slice(index + 1).trim()
        };
      }
    }
    return {condition: text.trim(), body: ''};
  }

  function findConditionalEnd(text, start) {
    let depth = 0;
    for (let index = start; index < text.length - 1; index += 1) {
      if (text.startsWith('[?', index)) {
        depth += 1;
        index += 1;
        continue;
      }
      if (text.startsWith('?]', index)) {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
        index += 1;
      }
    }
    return -1;
  }

  function sanitizeHtmlTag(raw, options) {
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>$/i.exec(String(raw || ''));
    if (!match) {
      return '';
    }
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    if (closing) {
      return tag === 'br' ? '' : '</' + tag + '>';
    }
    if (tag === 'br') {
      return '<br>';
    }
    if (tag === 'img') {
      return renderImageTag(match[3], options || {});
    }
    const style = sanitizeStyle(attrValue(match[3], 'style'));
    const attrs = [style ? 'style="' + escapeAttr(style) + '"' : '', tableCellAttrs(tag, match[3])].filter(Boolean).join(' ');
    return '<' + tag + (attrs ? ' ' + attrs : '') + '>';
  }

  function renderImageTag(attrs, options) {
    const src = safeAssetUrl(attrValue(attrs, 'src'), options || {});
    if (!src) {
      return '';
    }
    const alt = attrValue(attrs, 'alt');
    return '<img class="dendry-text-image" src="' + escapeAttr(src) + '" alt="' + escapeAttr(alt) + '" loading="lazy">';
  }

  function tableCellAttrs(tag, attrs) {
    if (tag !== 'td' && tag !== 'th') {
      return '';
    }
    const parts = [];
    ['colspan', 'rowspan'].forEach((name) => {
      const value = attrValue(attrs, name);
      if (/^[1-9][0-9]?$/.test(value)) {
        parts.push(name + '="' + escapeAttr(value) + '"');
      }
    });
    return parts.join(' ');
  }

  function parseMarkdownImage(value, options) {
    const match = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(String(value || ''));
    if (!match) {
      return null;
    }
    const src = safeAssetUrl(match[2], options || {});
    if (!src) {
      return null;
    }
    return {
      length: match[0].length,
      html: '<img class="dendry-text-image" src="' + escapeAttr(src) + '" alt="' + escapeAttr(match[1]) + '" loading="lazy">'
    };
  }

  function safeAssetUrl(value, options) {
    const raw = String(value || '').trim().replace(/&amp;/g, '&');
    if (!raw || /[<>{}]/.test(raw) || /^(?:javascript|data):/i.test(raw)) {
      return '';
    }
    if (!/\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(raw)) {
      return '';
    }
    if (/^(?:https?:|file:|blob:|\/)/i.test(raw)) {
      return raw;
    }
    const base = String(options && options.assetBaseUrl || '').trim();
    const relative = runtimeRelativeAssetPath(raw.replace(/^\.?\//, '').replace(/^\/+/, ''), options);
    if (!base) {
      return relative;
    }
    return base.replace(/\/+$/, '') + '/' + relative;
  }

  function runtimeRelativeAssetPath(value, options) {
    const relative = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const root = String(options && options.runtimeAssetRoot || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    if (!relative || !root || relative === root || relative.startsWith(root + '/')) {
      return relative;
    }
    const base = String(options && options.assetBaseUrl || '').replace(/\\/g, '/').replace(/\/+$/g, '');
    if (base.endsWith('/' + root) || base === root) {
      return relative;
    }
    return /^(?:img|images)\//i.test(relative) ? root + '/' + relative : relative;
  }

  function visualMarkupPlaceholder(raw) {
    const text = String(raw || '');
    if (/^<\s*\//.test(text) || /<\s*(?:script|style)\b/i.test(text)) {
      return '';
    }
    if (/<\s*(?:canvas|svg)\b|\b(?:chart|graph)\b/i.test(text)) {
      return '<span class="dendry-text-visual-token" data-dendry-token="visual" data-dendry-visual-kind="chart">chart</span>';
    }
    if (/<\s*img\b/i.test(text)) {
      return '<span class="dendry-text-visual-token" data-dendry-token="visual" data-dendry-visual-kind="asset">asset</span>';
    }
    return '';
  }

  function attrValue(attrs, name) {
    const pattern = new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", 'i');
    const match = pattern.exec(String(attrs || ''));
    return match ? (match[1] || match[2] || match[3] || '') : '';
  }

  function sanitizeStyle(value) {
    const parts = [];
    String(value || '').split(';').forEach((declaration) => {
      const index = declaration.indexOf(':');
      if (index <= 0) {
        return;
      }
      const prop = declaration.slice(0, index).trim().toLowerCase();
      const rawValue = declaration.slice(index + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop) || !safeCssValue(prop, rawValue)) {
        return;
      }
      parts.push(prop + ': ' + rawValue);
    });
    return parts.join('; ');
  }

  function safeCssValue(prop, value) {
    const text = String(value || '').trim();
    if (!text || text.length > 96 || /[<>{};@]/.test(text) || /url\s*\(|expression\s*\(|javascript:/i.test(text)) {
      return false;
    }
    if (prop === 'font-weight') {
      return /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(text);
    }
    if (prop === 'font-style') {
      return /^(normal|italic|oblique)$/i.test(text);
    }
    if (prop === 'text-decoration') {
      return /^(none|underline|line-through|overline)$/i.test(text);
    }
    return /^#[0-9a-f]{3,8}$/i.test(text) ||
      /^(?:rgb|rgba|hsl|hsla)\(\s*[-+.%\d\s,]+\)$/i.test(text) ||
      /^[a-z][a-z0-9-]*$/i.test(text);
  }

  function nextSpecialIndex(text, start) {
    let next = text.length;
    ['[+', '[?', '<', '**', '`'].forEach((needle) => {
      const index = text.indexOf(needle, start);
      if (index >= 0 && index < next) {
        next = index;
      }
    });
    return next;
  }

  function hasMarkup(value) {
    return /<\s*(?:span|strong|b|em|i|u|small|code|mark|br|sup|sub|table|thead|tbody|tfoot|tr|th|td|caption|figure|figcaption|img|canvas|svg)\b|!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]*)?\)|\[\+|\[\?|\*\*|`|^\s*=/im.test(String(value || ''));
  }

  function hasVisualBlockMarkup(value) {
    return /<\s*(?:table|thead|tbody|tfoot|tr|th|td|caption|figure|figcaption|img|canvas|svg)\b|!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]*)?\)/im.test(String(value || ''));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function withConditionalMode(options, mode) {
    return Object.assign({}, options && typeof options === 'object' ? options : {}, {conditionalMode: mode});
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
