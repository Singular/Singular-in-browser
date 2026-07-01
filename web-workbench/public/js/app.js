import {
  arrayBufferToBase64,
  basename,
  decodeText,
  downloadBlob,
  exportWorkspaceJson,
  getFile,
  importWorkspaceJson,
  listFiles,
  normalizePath,
  putFile,
  putText,
  deleteFile,
  textExtension
} from './workspace-db.js';
import { TUTORIALS, TUTORIAL_CATEGORIES } from '../tutorials/tutorials.js';

const CONTROL = '__singularControl';
const DEFAULT_SCRIPT = `ring r = 0,(x,y),dp;\nideal I = x2-y3, x3-y5;\nideal G = std(I);\nG;\nwrite(":w /workspace/example-output.txt", "Groebner basis of I:", G);\n`;
const PREVIOUS_DEFAULT_SCRIPTS = Object.freeze([
  `ring r = 0,(x,y),dp;\nideal I = x2-y3, x3-y5;\nstd(I);\n`
]);
const TERMINAL_HISTORY_LIMIT = 200;
const MAX_PULL_FILE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT_JSON_BYTES = 50 * 1024 * 1024;
const SESSION_FS_TIMEOUT_MS = 8000;
const VENDOR_MANIFEST = 'vendor/versions.json';
const ENGINE_MANIFEST = 'engine/engine-manifest.json';
const MANUSCRIPT_URL = 'https://agag-jboehm.math.rptu.de/~boehm/ca.pdf';
const TRUST_CONFIG = Object.freeze(globalThis.SINGULAR_WORKBENCH_TRUST || {});
const EXPECTED_VENDOR_ASSETS = Object.freeze([
  'vendor/xterm/xterm.css',
  'vendor/xterm/xterm.js',
  'vendor/xterm/addon-fit.js',
  'vendor/xterm-pty/index.mjs',
  'vendor/xterm-pty/workerTools.js',
  'vendor/katex/katex.min.css',
  'vendor/katex/katex.min.js'
]);
const EXPECTED_ENGINE_ASSETS = Object.freeze([
  'engine/Singular.js',
  'engine/Singular.wasm',
  'engine/Singular.data'
]);
const TUTORIAL_BY_ID = new Map(TUTORIALS.map(tutorial => [tutorial.id, tutorial]));
const TUTORIAL_CATEGORY_LIST = Object.freeze(
  TUTORIAL_CATEGORIES
    .map(category => Object.freeze({
      id: category.id,
      title: category.title,
      tutorials: Object.freeze(category.tutorialIds.map(id => TUTORIAL_BY_ID.get(id)).filter(Boolean))
    }))
    .filter(category => category.tutorials.length)
);
const IS_APPLE_PLATFORM = /mac|iphone|ipad|ipod/i.test(
  navigator.userAgentData?.platform || navigator.platform || ''
);
const PRIMARY_MODIFIER = IS_APPLE_PLATFORM ? 'metaKey' : 'ctrlKey';
const PRIMARY_LABEL = IS_APPLE_PLATFORM ? '⌘' : 'Ctrl';
const COMPACT_PRIMARY_LABEL = IS_APPLE_PLATFORM ? '⌘' : 'Ctrl';
const PRIMARY_ARIA = IS_APPLE_PLATFORM ? 'Meta' : 'Control';
const ALT_LABEL = IS_APPLE_PLATFORM ? 'Option' : 'Alt';
const COMPACT_ALT_LABEL = IS_APPLE_PLATFORM ? '⌥' : 'Alt';
const COMPACT_SHIFT_LABEL = IS_APPLE_PLATFORM ? '⇧' : 'Shift';
const SINGULAR_KEYWORDS = Object.freeze(new Set([
  'break',
  'continue',
  'else',
  'export',
  'for',
  'if',
  'keepring',
  'proc',
  'return',
  'static',
  'while'
]));
const SINGULAR_BUILTINS = Object.freeze(new Set([
  'attrib',
  'basering',
  'betti',
  'bigint',
  'def',
  'diff',
  'division',
  'eliminate',
  'execute',
  'groebner',
  'highcorner',
  'hilbPoly',
  'ideal',
  'int',
  'intmat',
  'intvec',
  'intersect',
  'irreddecMon',
  'jacob',
  'kernel',
  'lead',
  'leadcoef',
  'leadmonom',
  'lib',
  'LIB',
  'link',
  'list',
  'matrix',
  'maxideal',
  'minor',
  'minres',
  'module',
  'modulo',
  'normal',
  'number',
  'option',
  'poly',
  'primdecGTZ',
  'print',
  'qring',
  'quotient',
  'radical',
  'reduce',
  'res',
  'resolution',
  'ring',
  'setring',
  'size',
  'slocus',
  'sres',
  'std',
  'string',
  'subst',
  'syz',
  'timer',
  'typeof',
  'vector',
  'write'
]));

function ensureTutorialCategoryElement() {
  const existing = document.getElementById('tutorial-category');
  if (existing) return existing;
  const tutorialSelect = document.getElementById('tutorial-select');
  const select = document.createElement('select');
  select.id = 'tutorial-category';
  select.className = 'text-input';
  const label = document.createElement('label');
  label.htmlFor = select.id;
  label.className = 'small muted';
  label.textContent = 'Category:';
  if (tutorialSelect) tutorialSelect.before(label, select);
  return select;
}

const el = Object.freeze({
  statusDot: document.getElementById('engine-status-dot'),
  status: document.getElementById('engine-status'),
  detail: document.getElementById('engine-detail'),
  fileCount: document.getElementById('file-count'),
  fileFilter: document.getElementById('file-filter'),
  fileList: document.getElementById('file-list'),
  fileInput: document.getElementById('file-input'),
  jsonInput: document.getElementById('workspace-json-input'),
  pathInput: document.getElementById('path-input'),
  selectedPath: document.getElementById('selected-path'),
  tabEditor: document.getElementById('tab-editor'),
  tabTutorials: document.getElementById('tab-tutorials'),
  editorTabPanel: document.getElementById('editor-tab-panel'),
  tutorialTabPanel: document.getElementById('tutorial-tab-panel'),
  tutorialCategory: ensureTutorialCategoryElement(),
  tutorialSelect: document.getElementById('tutorial-select'),
  tutorialSummary: document.getElementById('tutorial-summary'),
  tutorialAppendEditor: document.getElementById('tutorial-append-editor'),
  tutorialPasteAll: document.getElementById('tutorial-paste-all'),
  tutorialMultiline: document.getElementById('tutorial-multiline'),
  tutorialContent: document.getElementById('tutorial-content'),
  editor: document.getElementById('editor'),
  editorHighlight: document.getElementById('editor-highlight'),
  output: document.getElementById('output-log'),
  terminalBox: document.getElementById('terminal'),
  folderStatus: document.getElementById('folder-status'),
  argNoRc: document.getElementById('arg-no-rc'),
  argNoShell: document.getElementById('arg-no-shell'),
  batchTimeout: document.getElementById('batch-timeout'),
  buttons: {
    newFile: document.getElementById('new-file'),
    upload: document.getElementById('upload-files'),
    download: document.getElementById('download-file'),
    delete: document.getElementById('delete-file'),
    openFolder: document.getElementById('open-folder'),
    pullFolder: document.getElementById('pull-folder'),
    pushFolder: document.getElementById('push-folder'),
    exportWorkspace: document.getElementById('export-workspace'),
    importWorkspace: document.getElementById('import-workspace'),
    saveEditor: document.getElementById('save-editor'),
    sendEditor: document.getElementById('send-editor'),
    runBatch: document.getElementById('run-batch'),
    loadLib: document.getElementById('load-lib'),
    start: document.getElementById('start-session'),
    restart: document.getElementById('restart-session'),
    terminate: document.getElementById('terminate-session'),
    clearTerminal: document.getElementById('clear-terminal'),
    benchmark: document.getElementById('benchmark'),
    copyOutput: document.getElementById('copy-output')
  }
});

let terminal = null;
let fitAddon = null;
let terminalDataDisposable = null;
let terminalResizeHandler = null;
let worker = null;
let sessionStarting = false;
let ptyServer = null;
let ptyMaster = null;
let ptySlave = null;
let terminalInputWriter = null;
let terminalInputMethod = '';
let selectedPath = '/workspace/example.sing';
let folderHandle = null;
let terminalCurrentLine = '';
let terminalInputCursor = 0;
let terminalHistoryCursor = null;
let terminalHistoryDraft = '';
let terminalKeydownHandler = null;
let terminalPasteHandler = null;
let activeWorkbenchTab = 'editor';
let currentTutorialSteps = [];
let workerRequestId = 0;
let ptyModulePromise = null;
let vendorVerified = false;
let engineVerified = false;
let releaseVerified = false;
let trustedReleaseManifest = null;
const terminalHistory = [];
const sessionFiles = new Map();
const sessionBaselines = new Map();
const pendingSessionBaselines = new Set();
const pendingWorkerRequests = new Map();

function keyLabel(key) {
  if (key === ' ') return 'Space';
  if (key === 'Backspace') return 'Backspace';
  if (key === 'Escape') return 'Esc';
  return key.length === 1 ? key.toUpperCase() : key;
}

function compactKeyLabel(key) {
  if (!IS_APPLE_PLATFORM) return key === 'Backspace' ? 'Bksp' : keyLabel(key);
  if (key === 'Enter') return '↵';
  if (key === 'Backspace') return '⌫';
  if (key === 'Escape') return 'Esc';
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key;
}

function shortcut(key, { primary = true, alt = false, shift = false } = {}) {
  const labelParts = [];
  const compactParts = [];
  const ariaParts = [];
  if (primary) {
    labelParts.push(PRIMARY_LABEL);
    compactParts.push(COMPACT_PRIMARY_LABEL);
    ariaParts.push(PRIMARY_ARIA);
  }
  if (alt) {
    labelParts.push(ALT_LABEL);
    compactParts.push(COMPACT_ALT_LABEL);
    ariaParts.push('Alt');
  }
  if (shift) {
    labelParts.push('Shift');
    compactParts.push(COMPACT_SHIFT_LABEL);
    ariaParts.push('Shift');
  }
  labelParts.push(keyLabel(key));
  compactParts.push(compactKeyLabel(key));
  ariaParts.push(key);
  return Object.freeze({
    key: key.length === 1 ? key.toLowerCase() : key,
    primary,
    alt,
    shift,
    label: labelParts.join('+'),
    compactLabel: IS_APPLE_PLATFORM ? compactParts.join('') : compactParts.join('+'),
    aria: ariaParts.join('+')
  });
}

const SHORTCUTS = Object.freeze({
  newFile: shortcut('n', { alt: true }),
  upload: shortcut('f', { alt: true }),
  download: shortcut('d', { alt: true }),
  delete: shortcut('Backspace', { alt: true }),
  openFolder: shortcut('o', { alt: true }),
  pullFolder: shortcut('p', { alt: true }),
  pushFolder: shortcut('u', { alt: true }),
  exportWorkspace: shortcut('e', { alt: true }),
  importWorkspace: shortcut('i', { alt: true }),
  saveEditor: shortcut('s'),
  sendEditor: shortcut('Enter'),
  runBatch: shortcut('Enter', { shift: true }),
  loadLib: shortcut('l', { alt: true }),
  start: shortcut('s', { alt: true }),
  restart: shortcut('r', { alt: true }),
  terminate: shortcut('x', { alt: true }),
  clearTerminal: shortcut('k', { alt: true }),
  benchmark: shortcut('b', { alt: true }),
  copyOutput: shortcut('c', { alt: true })
});

const STARTUP_STAGES = Object.freeze([
  ['Verify', 'verifying engine and release assets'],
  ['Terminal', 'opening terminal'],
  ['PTY', 'creating terminal bridge'],
  ['Worker', 'starting Singular worker'],
  ['Sync', 'copying workspace files'],
  ['Attach', 'attaching terminal runtime']
]);

function setStatus(kind, text, detail = '') {
  el.statusDot.className = `dot${kind ? ` ${kind}` : ''}`;
  el.status.textContent = text;
  el.detail.textContent = detail;
}

function setStartButtonState(state, label = '') {
  const button = el.buttons.start;
  if (!button) return;
  button.dataset.sessionState = state || '';
  if (state === 'starting') button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
  const text = button.querySelector('.button-label');
  if (text) text.textContent = label || button.dataset.label || 'Start';
}

function setStartupStage(index) {
  const [label, detail] = STARTUP_STAGES[index - 1];
  const total = STARTUP_STAGES.length;
  setStartButtonState('starting', `${index}/${total} ${label}`);
  setStatus('busy', `Starting ${index}/${total}`, detail);
  log(`Startup ${index}/${total}: ${detail}.`);
}

function log(message) {
  const stamp = new Date().toLocaleTimeString();
  el.output.textContent += `[${stamp}] ${message}\n`;
  el.output.scrollTop = el.output.scrollHeight;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenSpan(className, text) {
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function highlightSingular(source) {
  const text = String(source || '');
  let html = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (rest.startsWith('/*')) {
      const end = text.indexOf('*/', i + 2);
      const next = end < 0 ? text.length : end + 2;
      html += tokenSpan('tok-comment', text.slice(i, next));
      i = next;
      continue;
    }
    if (rest.startsWith('//')) {
      const end = text.indexOf('\n', i + 2);
      const next = end < 0 ? text.length : end;
      html += tokenSpan('tok-comment', text.slice(i, next));
      i = next;
      continue;
    }
    const quote = text[i];
    if (quote === '"' || quote === "'") {
      let next = i + 1;
      while (next < text.length) {
        if (text[next] === '\\') {
          next += 2;
          continue;
        }
        if (text[next] === quote) {
          next += 1;
          break;
        }
        next += 1;
      }
      html += tokenSpan('tok-string', text.slice(i, next));
      i = next;
      continue;
    }
    const number = /^[0-9]+(?:\.[0-9]+)?/.exec(rest);
    if (number) {
      html += tokenSpan('tok-number', number[0]);
      i += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      const value = word[0];
      const lower = value.toLowerCase();
      if (SINGULAR_KEYWORDS.has(lower)) html += tokenSpan('tok-keyword', value);
      else if (SINGULAR_BUILTINS.has(value) || SINGULAR_BUILTINS.has(lower)) html += tokenSpan('tok-builtin', value);
      else html += escapeHtml(value);
      i += value.length;
      continue;
    }
    html += escapeHtml(text[i]);
    i += 1;
  }
  return html.endsWith('\n') ? `${html} ` : (html || ' ');
}

function refreshEditorHighlight() {
  if (!el.editorHighlight) return;
  el.editorHighlight.innerHTML = shouldHighlightEditor()
    ? highlightSingular(el.editor.value)
    : escapeHtml(el.editor.value || ' ');
  el.editorHighlight.scrollTop = el.editor.scrollTop;
  el.editorHighlight.scrollLeft = el.editor.scrollLeft;
}

function setEditorValue(value, { focus = false } = {}) {
  el.editor.value = String(value || '');
  refreshEditorHighlight();
  if (focus) el.editor.focus();
}

function setWorkbenchTab(tab) {
  activeWorkbenchTab = tab === 'tutorials' ? 'tutorials' : 'editor';
  const showTutorials = activeWorkbenchTab === 'tutorials';
  el.tabEditor.setAttribute('aria-selected', showTutorials ? 'false' : 'true');
  el.tabTutorials.setAttribute('aria-selected', showTutorials ? 'true' : 'false');
  el.tabEditor.tabIndex = showTutorials ? -1 : 0;
  el.tabTutorials.tabIndex = showTutorials ? 0 : -1;
  el.editorTabPanel.hidden = showTutorials;
  el.tutorialTabPanel.hidden = !showTutorials;
  if (showTutorials) el.tutorialSelect.focus();
  else el.editor.focus();
}

function safeTutorialImageSrc(src) {
  const value = String(src || '').trim();
  if (!/^tutorials\/images\/[-A-Za-z0-9_./]+\.(?:jpe?g|png|webp)$/i.test(value)) return '';
  if (value.split('/').includes('..')) return '';
  return value;
}

const LATEX_SYMBOLS = Object.freeze({
  A: 'A',
  C: 'C',
  F: 'F',
  K: 'K',
  P: 'P',
  Q: 'Q',
  R: 'R',
  Z: 'Z',
  bar: '',
  cap: '∩',
  cdot: '·',
  colon: ':',
  cong: '≅',
  dots: '…',
  geq: '≥',
  infty: '∞',
  in: '∈',
  langle: '⟨',
  ldots: '…',
  leq: '≤',
  mapsto: '↦',
  mathcal: '',
  mathfrak: '',
  mathbb: '',
  neq: '≠',
  operatorname: '',
  op: '⊕',
  oplus: '⊕',
  otimes: '⊗',
  qquad: '\u2003\u2003',
  quad: '\u2003',
  rangle: '⟩',
  rightarrow: '→',
  sqrt: '√',
  subset: '⊂',
  times: '×',
  xrightarrow: '→',
  to: '→'
});

const MATHBB_SYMBOLS = Object.freeze({
  A: '𝔸',
  C: 'ℂ',
  F: '𝔽',
  K: '𝕂',
  N: 'ℕ',
  P: 'ℙ',
  Q: 'ℚ',
  R: 'ℝ',
  Z: 'ℤ'
});

const MATHFRAK_SYMBOLS = Object.freeze({
  m: '𝔪'
});

function replaceLatexCommands(text) {
  return String(text || '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\[,;:]/g, '\u2009')
    .replace(/\\!/g, '')
    .replace(/\\([A-Za-z]+)/g, (_, command) => LATEX_SYMBOLS[command] ?? command);
}

function renderMathSegment(text) {
  let html = '';
  for (const char of String(text || '')) {
    if (/^[A-Za-z]$/.test(char)) {
      html += `<var>${escapeHtml(char)}</var>`;
    } else if (char === '-') {
      html += '−';
    } else if (char === '*') {
      html += '·';
    } else {
      html += escapeHtml(char);
    }
  }
  return html;
}

function renderMathText(text) {
  const tokenPattern = /(\uE100\d+\uE101)/g;
  return String(text || '')
    .split(tokenPattern)
    .map(part => /^\uE100\d+\uE101$/.test(part) ? part : renderMathSegment(part))
    .join('');
}

function renderLatexContents(math) {
  const fragments = [];
  const stash = html => {
    const token = `\uE100${fragments.length}\uE101`;
    fragments.push(html);
    return token;
  };
  let value = String(math || '').trim();
  value = value.replace(/\\operatorname\{([^{}]+)\}/g, (_, operator) => {
    return stash(`<span class="math-op">${escapeHtml(operator)}</span>`);
  });
  value = value.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (_, body) => {
    const rows = String(body).split(/\\\\/).map(row => row.split('&').map(cell => renderLatexContents(cell.trim())));
    return stash(`<span class="math-matrix">${rows.map(row => `<span class="math-matrix-row">${row.map(cell => `<span>${cell}</span>`).join('')}</span>`).join('')}</span>`);
  });
  value = value.replace(/\\bar\{([^{}]+)\}/g, (_, body) => {
    return stash(`<span class="math-overline">${renderLatexContents(body)}</span>`);
  });
  value = value.replace(/\\bar\s+([A-Za-z])/g, (_, body) => {
    return stash(`<span class="math-overline">${renderLatexContents(body)}</span>`);
  });
  value = value.replace(/\\sqrt\{([^{}]+)\}/g, (_, body) => {
    return stash(`<span class="math-root"><span>√</span><span>${renderLatexContents(body)}</span></span>`);
  });
  value = value.replace(/\\xrightarrow\{([^{}]+)\}/g, (_, label) => {
    return stash(`<span class="math-arrow">→<sup>${renderLatexContents(label)}</sup></span>`);
  });
  value = value.replace(/\\mathbb\{([A-Za-z])\}/g, (_, symbol) => MATHBB_SYMBOLS[symbol] || symbol);
  value = value.replace(/\\mathbb\s+([A-Za-z])/g, (_, symbol) => MATHBB_SYMBOLS[symbol] || symbol);
  value = value.replace(/\\mathfrak\{([A-Za-z])\}/g, (_, symbol) => MATHFRAK_SYMBOLS[symbol] || symbol);
  value = value.replace(/\\mathfrak\s+([A-Za-z])/g, (_, symbol) => MATHFRAK_SYMBOLS[symbol] || symbol);
  value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => {
    return stash(`<span class="math-frac"><span>${renderLatexContents(numerator)}</span><span>${renderLatexContents(denominator)}</span></span>`);
  });
  value = value.replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])/g, (_, numerator, denominator) => {
    return stash(`<span class="math-frac"><span>${renderLatexContents(numerator)}</span><span>${renderLatexContents(denominator)}</span></span>`);
  });
  value = value.replace(/([_^])\{([^{}]+)\}/g, (_, marker, body) => {
    const tag = marker === '^' ? 'sup' : 'sub';
    return stash(`<${tag}>${renderLatexContents(body)}</${tag}>`);
  });
  value = value.replace(/([_^])([A-Za-z0-9+-])/g, (_, marker, body) => {
    const tag = marker === '^' ? 'sup' : 'sub';
    return stash(`<${tag}>${renderLatexContents(body)}</${tag}>`);
  });
  value = replaceLatexCommands(value);
  let html = renderMathText(value);
  for (const [index, fragment] of fragments.entries()) {
    html = html.replaceAll(`\uE100${index}\uE101`, fragment);
  }
  return html;
}

function renderLatexFallback(math) {
  return `<span class="tutorial-math">${renderLatexContents(math)}</span>`;
}

function renderLatex(math, { displayMode = false } = {}) {
  const katex = globalThis.katex;
  if (typeof katex?.renderToString === 'function') {
    try {
      return katex.renderToString(String(math || '').trim(), {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'htmlAndMathml'
      });
    } catch {
      return renderLatexFallback(math);
    }
  }
  return renderLatexFallback(math);
}

function renderLatexInline(math) {
  return renderLatex(math);
}

function renderInlineMarkdown(text) {
  const fragments = [];
  const stash = html => {
    const token = `\uE000${fragments.length}\uE001`;
    fragments.push(html);
    return token;
  };
  let source = String(text || '');
  source = source.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\\\((.*?)\\\)/g, (_, math) => stash(renderLatexInline(math)));
  source = source.replace(/\$([^$]+)\$/g, (_, math) => stash(renderLatexInline(math)));
  let html = escapeHtml(source).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const [index, fragment] of fragments.entries()) {
    html = html.replaceAll(`\uE000${index}\uE001`, fragment);
  }
  return html;
}

function renderTutorialMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    const displayMath = /^\$\$([\s\S]+)\$\$$/.exec(trimmed);
    if (displayMath) {
      flushParagraph();
      html.push(`<div class="tutorial-math-display">${renderLatex(displayMath[1], { displayMode: true })}</div>`);
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image) {
      flushParagraph();
      const src = safeTutorialImageSrc(image[2]);
      if (src) {
        const alt = escapeHtml(image[1] || 'Tutorial figure');
        html.push(`<figure class="tutorial-figure"><img src="${src}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`);
      }
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return html.join('');
}

function tutorialBlocks(tutorial) {
  if (Array.isArray(tutorial?.blocks)) return tutorial.blocks;
  return [{ code: tutorial?.code, source: tutorial?.source }];
}

function tutorialCodeText(tutorial) {
  return tutorialBlocks(tutorial)
    .map(block => String(block.code || '').trim())
    .filter(Boolean)
    .join('\n');
}

function tutorialPhysicalLineSteps(tutorial) {
  const steps = [];
  for (const block of tutorialBlocks(tutorial)) {
    const source = block.source || tutorial.source || '';
    const lines = String(block.code || '').trim().split(/\r?\n/);
    for (const [lineIndex, codeLine] of lines.entries()) {
      const code = codeLine.replace(/\s+$/, '');
      if (!code.trim()) continue;
      steps.push({
        code,
        source,
        startLine: lineIndex + 1,
        endLine: lineIndex + 1,
        lineLabel: String(lineIndex + 1)
      });
    }
  }
  return steps;
}

function singularStatementEnds(line) {
  return /;\s*(?:\/\/.*)?$/.test(String(line || '').trim());
}

function flushTutorialStep(steps, pending, source, startLine, endLine) {
  if (!pending.length) return;
  steps.push({
    code: pending.join('\n'),
    source,
    startLine,
    endLine,
    lineLabel: startLine === endLine ? String(startLine) : `${startLine}-${endLine}`
  });
}

function tutorialStatementSteps(tutorial) {
  const steps = [];
  for (const block of tutorialBlocks(tutorial)) {
    const source = block.source || tutorial.source || '';
    const lines = String(block.code || '').trim().split(/\r?\n/);
    let pending = [];
    let startLine = 0;
    let endLine = 0;
    for (const [lineIndex, codeLine] of lines.entries()) {
      const code = codeLine.replace(/\s+$/, '');
      if (!code.trim()) continue;
      if (!pending.length) startLine = lineIndex + 1;
      endLine = lineIndex + 1;
      pending.push(code);
      if (singularStatementEnds(code)) {
        flushTutorialStep(steps, pending, source, startLine, endLine);
        pending = [];
      }
    }
    flushTutorialStep(steps, pending, source, startLine, endLine);
  }
  return steps;
}

function buildTutorialSteps(tutorial) {
  return el.tutorialMultiline?.checked
    ? tutorialStatementSteps(tutorial)
    : tutorialPhysicalLineSteps(tutorial);
}

function tutorialStepTerminalCode(step) {
  return String(step?.code || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
}

function createTutorialCodeStepButton(step, index, tutorial) {
  const button = document.createElement('button');
  const lineNumber = document.createElement('span');
  const scroll = document.createElement('span');
  const code = document.createElement('code');
  button.type = 'button';
  button.className = 'tutorial-code-line-button';
  if (step.startLine !== step.endLine) button.classList.add('is-multiline');
  button.setAttribute('aria-label', `Paste tutorial lines ${step.lineLabel} from ${tutorial.title} into the Singular terminal`);
  button.title = step.source ? `Paste lines ${step.lineLabel} from ${step.source}` : `Paste lines ${step.lineLabel}`;
  lineNumber.className = 'tutorial-code-line-number';
  lineNumber.textContent = step.lineLabel;
  scroll.className = 'tutorial-code-scroll';
  code.innerHTML = highlightSingular(step.code || '');
  scroll.append(code);
  button.append(lineNumber, scroll);
  button.addEventListener('click', () => runAction('Paste tutorial step', () => sendTutorialCode(index)));
  button.addEventListener('keydown', scrollTutorialCodeLineWithKeyboard);
  return button;
}

function scrollTutorialCodeLineWithKeyboard(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const scroll = event.currentTarget.querySelector('.tutorial-code-scroll');
  if (!scroll || scroll.scrollWidth <= scroll.clientWidth + 1) return;
  event.preventDefault();
  scroll.scrollLeft += event.key === 'ArrowLeft' ? -56 : 56;
}

function updateTutorialLineOverflow() {
  for (const button of el.tutorialContent.querySelectorAll('.tutorial-code-line-button')) {
    const scroll = button.querySelector('.tutorial-code-scroll');
    const overflowing = Boolean(scroll && scroll.scrollWidth > scroll.clientWidth + 1);
    button.classList.toggle('is-overflowing', overflowing);
  }
}

function selectedTutorialCategory() {
  const index = Math.max(0, Math.min(TUTORIAL_CATEGORY_LIST.length - 1, Number(el.tutorialCategory.value || 0)));
  return TUTORIAL_CATEGORY_LIST[index] || { id: 'all', title: 'Tutorials', tutorials: TUTORIALS };
}

function currentTutorialList() {
  return selectedTutorialCategory().tutorials || [];
}

function renderTutorialCategories() {
  el.tutorialCategory.textContent = '';
  for (const [index, category] of TUTORIAL_CATEGORY_LIST.entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = category.title;
    el.tutorialCategory.append(option);
  }
}

function renderTutorialOptions(preferredTutorialId = '') {
  const tutorials = currentTutorialList();
  el.tutorialSelect.textContent = '';
  for (const [index, tutorial] of tutorials.entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = tutorial.title;
    el.tutorialSelect.append(option);
  }
  const preferredIndex = tutorials.findIndex(tutorial => tutorial.id === preferredTutorialId);
  el.tutorialSelect.value = String(Math.max(0, preferredIndex));
}

function renderTutorial() {
  const category = selectedTutorialCategory();
  const tutorials = category.tutorials || [];
  const index = Math.max(0, Math.min(tutorials.length - 1, Number(el.tutorialSelect.value || 0)));
  const tutorial = tutorials[index];
  currentTutorialSteps = [];
  el.tutorialContent.textContent = '';
  if (!tutorial) {
    el.tutorialSummary.textContent = 'No tutorials available.';
    return;
  }
  el.tutorialSummary.textContent = '';
  const source = document.createElement('span');
  source.textContent = tutorial.source || '';
  const separator = document.createElement('span');
  separator.textContent = ' - ';
  const link = document.createElement('a');
  const page = Number(tutorial.pdfPage || 1);
  link.href = `${MANUSCRIPT_URL}#page=${Math.max(1, page)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'manuscript';
  const count = document.createElement('span');
  count.textContent = ` - ${tutorials.length} ${tutorials.length === 1 ? 'tutorial' : 'tutorials'} in ${category.title}`;
  el.tutorialSummary.append(source, separator, link, count);
  const markdown = renderTutorialMarkdown(tutorial.markdown);
  if (markdown) {
    const intro = document.createElement('div');
    intro.className = 'tutorial-markdown';
    intro.innerHTML = markdown;
    el.tutorialContent.append(intro);
  }

  currentTutorialSteps = buildTutorialSteps(tutorial);
  const list = document.createElement('div');
  list.className = 'tutorial-code-list';
  list.setAttribute('aria-label', `Code steps for ${tutorial.title}`);
  for (const [stepIndex, step] of currentTutorialSteps.entries()) {
    list.append(createTutorialCodeStepButton(step, stepIndex, tutorial));
  }
  el.tutorialContent.append(list);
  requestAnimationFrame(updateTutorialLineOverflow);
}

function rememberTerminalCommand(line) {
  const command = String(line || '').trimEnd();
  if (!command.trim()) return;
  if (terminalHistory[terminalHistory.length - 1] === command) return;
  terminalHistory.push(command);
  if (terminalHistory.length > TERMINAL_HISTORY_LIMIT) terminalHistory.shift();
}

function rememberTerminalCommands(text) {
  for (const line of String(text || '').split(/\r?\n/)) rememberTerminalCommand(line);
}

function terminalLineChars(value = terminalCurrentLine) {
  return Array.from(String(value || ''));
}

function terminalLineLength(value = terminalCurrentLine) {
  return terminalLineChars(value).length;
}

function syncTerminalLineDisciplineInput() {
  // Keyboard command-line editing is handled locally in the browser. The PTY
  // line discipline receives only the completed line on Enter, so its internal
  // canonical buffer must not be mirrored here.
}

function setTerminalCurrentLine(value, cursor = terminalLineLength(value), { sync = true } = {}) {
  terminalCurrentLine = String(value || '');
  terminalInputCursor = Math.max(0, Math.min(terminalLineLength(), cursor));
  if (sync) syncTerminalLineDisciplineInput();
}

function resetTerminalCurrentLine(options = {}) {
  setTerminalCurrentLine('', 0, options);
}

function resetTerminalLineNavigation() {
  terminalHistoryCursor = null;
  terminalHistoryDraft = '';
}

function writeTerminalKeystrokes(text) {
  const value = String(text || '');
  if (typeof ptyMaster?.ldisc?.writeFromLower === 'function') {
    ptyMaster.ldisc.writeFromLower(value);
    return true;
  }
  if (typeof terminal?._core?.coreService?.triggerDataEvent === 'function') {
    terminal._core.coreService.triggerDataEvent(value, true);
    return true;
  }
  if (typeof terminal?.input === 'function') {
    terminal.input(value);
    return true;
  }
  return writeTerminalInput(value, { quiet: true });
}

function scrollTerminalToBottomSoon() {
  const scrollAndRefresh = () => {
    terminal?.scrollToBottom?.();
    terminal?.refresh?.(0, Math.max(0, (terminal?.rows || 1) - 1));
  };
  scrollAndRefresh();
  requestAnimationFrame(scrollAndRefresh);
  for (const delayMs of [50, 150, 500, 1200]) {
    setTimeout(scrollAndRefresh, delayMs);
  }
}

function terminalCursorSequence(direction, columns) {
  const count = Math.max(0, Math.floor(columns));
  return count ? `\x1b[${count}${direction}` : '';
}

function moveTerminalInputCursorTo(position) {
  const length = terminalLineLength();
  const next = Math.max(0, Math.min(length, position));
  const delta = next - terminalInputCursor;
  if (delta < 0) terminal?.write?.(terminalCursorSequence('D', -delta));
  else if (delta > 0) terminal?.write?.(terminalCursorSequence('C', delta));
  terminalInputCursor = next;
  return true;
}

function moveTerminalInputCursorToEnd() {
  return moveTerminalInputCursorTo(terminalLineLength());
}

function clearTerminalInputLine() {
  moveTerminalInputCursorToEnd();
  const length = terminalLineLength();
  if (length) {
    terminal?.write?.(`${terminalCursorSequence('D', length)}${' '.repeat(length)}${terminalCursorSequence('D', length)}`);
  }
  resetTerminalCurrentLine();
}

function insertTerminalInputAtCursor(text, { resetNavigation = true } = {}) {
  const value = String(text || '');
  const insertLength = terminalLineLength(value);
  if (!insertLength) return false;
  const chars = terminalLineChars();
  const before = chars.slice(0, terminalInputCursor).join('');
  const after = chars.slice(terminalInputCursor).join('');
  setTerminalCurrentLine(`${before}${value}${after}`, terminalInputCursor + insertLength);
  terminal?.write?.(`${value}${after}${terminalCursorSequence('D', terminalLineLength(after))}`);
  if (resetNavigation) resetTerminalLineNavigation();
  return true;
}

function deleteTerminalInputBeforeCursor() {
  if (terminalInputCursor <= 0) return true;
  const chars = terminalLineChars();
  const after = chars.slice(terminalInputCursor).join('');
  chars.splice(terminalInputCursor - 1, 1);
  setTerminalCurrentLine(chars.join(''), terminalInputCursor - 1);
  terminal?.write?.(`${terminalCursorSequence('D', 1)}${after} ${terminalCursorSequence('D', terminalLineLength(after) + 1)}`);
  resetTerminalLineNavigation();
  return true;
}

function deleteTerminalInputAtCursor() {
  const chars = terminalLineChars();
  if (terminalInputCursor >= chars.length) return true;
  const after = chars.slice(terminalInputCursor + 1).join('');
  chars.splice(terminalInputCursor, 1);
  setTerminalCurrentLine(chars.join(''), terminalInputCursor);
  terminal?.write?.(`${after} ${terminalCursorSequence('D', terminalLineLength(after) + 1)}`);
  resetTerminalLineNavigation();
  return true;
}

function submitTerminalInputLine() {
  const line = terminalCurrentLine;
  moveTerminalInputCursorToEnd();
  terminal?.write?.('\r\n');
  rememberTerminalCommand(line);
  resetTerminalCurrentLine();
  resetTerminalLineNavigation();
  scrollTerminalToBottomSoon();
  if (writePtyServerInput(`${line}\n`)) return true;
  return writeTerminalKeystrokes(`${line}\r`);
}

function consumeTerminalEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function handleTerminalEditingKey(event) {
  const key = event.key || '';
  const code = event.code || '';
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if (key === 'ArrowUp' || key === 'Up' || code === 'ArrowUp') {
    navigateTerminalHistory(-1);
    return true;
  }
  if (key === 'ArrowDown' || key === 'Down' || code === 'ArrowDown') {
    navigateTerminalHistory(1);
    return true;
  }
  if (key === 'ArrowLeft' || key === 'Left' || code === 'ArrowLeft') return moveTerminalInputCursorTo(terminalInputCursor - 1);
  if (key === 'ArrowRight' || key === 'Right' || code === 'ArrowRight') return moveTerminalInputCursorTo(terminalInputCursor + 1);
  if (key === 'Home' || code === 'Home') return moveTerminalInputCursorTo(0);
  if (key === 'End' || code === 'End') return moveTerminalInputCursorToEnd();
  if (key === 'Delete' || code === 'Delete') return deleteTerminalInputAtCursor();
  if (key === 'Enter' || code === 'Enter' || code === 'NumpadEnter') return submitTerminalInputLine();
  if (key === 'Backspace' || code === 'Backspace') return deleteTerminalInputBeforeCursor();
  if (event.key?.length === 1) return insertTerminalInputAtCursor(event.key);
  return false;
}

function handleTerminalKeydownCapture(event) {
  if (handleTerminalEditingKey(event)) consumeTerminalEvent(event);
}

function insertPastedTerminalText(text) {
  const value = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!value) return false;
  const parts = value.split('\n');
  for (const [index, part] of parts.entries()) {
    if (part) insertTerminalInputAtCursor(part);
    if (index < parts.length - 1) submitTerminalInputLine();
  }
  return true;
}

function handleTerminalPasteCapture(event) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  consumeTerminalEvent(event);
  insertPastedTerminalText(text);
}

function noteTerminalData(data) {
  const text = String(data || '');
  if (!text || text.includes('\x1b')) return;
  for (const char of text) {
    if (char === '\r' || char === '\n') {
      rememberTerminalCommand(terminalCurrentLine);
      resetTerminalCurrentLine({ sync: false });
      resetTerminalLineNavigation();
    } else if (char === '\x7f' || char === '\b') {
      const next = terminalLineChars().slice(0, -1).join('');
      setTerminalCurrentLine(next, terminalLineLength(next), { sync: false });
      resetTerminalLineNavigation();
    } else if (char === '\x15') {
      resetTerminalCurrentLine({ sync: false });
      resetTerminalLineNavigation();
    } else if (char >= ' ') {
      const next = `${terminalCurrentLine}${char}`;
      setTerminalCurrentLine(next, terminalLineLength(next), { sync: false });
      resetTerminalLineNavigation();
    }
  }
}

function replaceTerminalInputLine(value) {
  const next = String(value || '');
  clearTerminalInputLine();
  if (next) insertTerminalInputAtCursor(next, { resetNavigation: false });
  return true;
}

function navigateTerminalHistory(direction) {
  if (!terminalHistory.length || !terminalInputWriter) return false;
  if (terminalHistoryCursor === null) {
    terminalHistoryDraft = terminalCurrentLine;
    terminalHistoryCursor = terminalHistory.length;
  }
  terminalHistoryCursor = Math.max(0, Math.min(terminalHistory.length, terminalHistoryCursor + direction));
  const next = terminalHistoryCursor === terminalHistory.length
    ? terminalHistoryDraft
    : terminalHistory[terminalHistoryCursor];
  return replaceTerminalInputLine(next);
}

function formatRuntimeMs(ms) {
  const number = Number(ms);
  return Number.isFinite(number) ? `${Math.round(number)} ms` : 'unknown';
}

function requireWebCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required to verify asset hashes. Use HTTPS or localhost.');
  }
}

async function sha256Hex(buffer) {
  requireWebCrypto();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeOptionalUrl(value) {
  const text = String(value || '').trim();
  return text || '';
}

function hasTrustedReleaseConfig() {
  return Boolean(normalizeOptionalUrl(TRUST_CONFIG.releaseManifestUrl));
}

function pemToArrayBuffer(pem, label) {
  const clean = String(pem || '')
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s+/g, '');
  if (!clean) throw new Error(`Missing ${label} PEM data.`);
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function verifyReleaseSignature(manifestText, signatureUrl, publicKeyPem) {
  requireWebCrypto();
  const response = await fetch(signatureUrl, { cache: 'no-store', mode: 'cors' });
  if (!response.ok) throw new Error(`Release manifest signature returned HTTP ${response.status}`);
  const signature = await response.arrayBuffer();
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem, 'PUBLIC KEY'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    new TextEncoder().encode(manifestText)
  );
  if (!ok) throw new Error('Release manifest signature is invalid.');
}

async function loadManifest(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest?.format !== 'singular-browser-workbench.asset-manifest.v1' || !manifest.assets) {
    throw new Error(`${path} is not a Singular Online asset manifest`);
  }
  return manifest;
}

async function loadTrustedReleaseManifest() {
  const releaseManifestUrl = normalizeOptionalUrl(TRUST_CONFIG.releaseManifestUrl);
  if (!releaseManifestUrl) return null;

  const response = await fetch(releaseManifestUrl, { cache: 'no-store', mode: 'cors' });
  if (!response.ok) throw new Error(`Trusted release manifest returned HTTP ${response.status}`);
  const manifestText = await response.text();

  const releaseSignatureUrl = normalizeOptionalUrl(TRUST_CONFIG.releaseSignatureUrl);
  const publicKeyPem = String(TRUST_CONFIG.publicKeyPem || '').trim();
  if (!releaseSignatureUrl || !publicKeyPem) {
    throw new Error('Trusted release verification needs releaseSignatureUrl and publicKeyPem.');
  }
  await verifyReleaseSignature(manifestText, releaseSignatureUrl, publicKeyPem);
  log(`Verified release manifest signature from ${releaseSignatureUrl}.`);

  const manifest = JSON.parse(manifestText);
  if (manifest?.format !== 'singular-browser-workbench.asset-manifest.v1' || !manifest.assets) {
    throw new Error(`${releaseManifestUrl} is not a Singular Online asset manifest`);
  }
  return manifest;
}

async function verifyAsset(relPath, expected) {
  if (!expected?.sha256) throw new Error(`No SHA-256 checksum for ${relPath}`);
  const response = await fetch(relPath, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${relPath} returned HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (Number.isFinite(expected.bytes) && buffer.byteLength !== expected.bytes) {
    throw new Error(`${relPath} size mismatch: expected ${expected.bytes}, got ${buffer.byteLength}`);
  }
  const actual = await sha256Hex(buffer);
  if (actual !== expected.sha256) {
    throw new Error(`${relPath} SHA-256 mismatch`);
  }
  return { path: relPath, bytes: buffer.byteLength, sha256: actual };
}

async function verifyManifestAssets(manifest, relPaths) {
  const verified = [];
  for (const relPath of relPaths) {
    verified.push(await verifyAsset(relPath, manifest.assets[relPath]));
  }
  return verified;
}

function requireManifestAssets(manifest, relPaths, label) {
  const missing = relPaths.filter(relPath => !manifest.assets?.[relPath]);
  if (missing.length) {
    throw new Error(`${label} does not list required asset(s): ${missing.join(', ')}`);
  }
}

async function ensureTrustedReleaseVerified() {
  if (releaseVerified) return trustedReleaseManifest;
  const manifest = await loadTrustedReleaseManifest();
  if (!manifest) {
    releaseVerified = true;
    return null;
  }
  const assets = Object.keys(manifest.assets);
  requireManifestAssets(manifest, EXPECTED_ENGINE_ASSETS, 'Trusted release manifest');
  requireManifestAssets(manifest, EXPECTED_VENDOR_ASSETS, 'Trusted release manifest');
  await verifyManifestAssets(manifest, assets);
  trustedReleaseManifest = manifest;
  releaseVerified = true;
  log(`Verified ${assets.length} deployed asset(s) against ${TRUST_CONFIG.releaseManifestUrl}.`);
  return trustedReleaseManifest;
}

async function ensureVendorVerified() {
  if (vendorVerified) return;
  const releaseManifest = await ensureTrustedReleaseVerified();
  if (releaseManifest) {
    vendorVerified = true;
    log('Trusted release manifest covers browser vendor assets.');
    return;
  }
  const manifest = await loadManifest(VENDOR_MANIFEST);
  requireManifestAssets(manifest, EXPECTED_VENDOR_ASSETS, VENDOR_MANIFEST);
  const assets = Object.keys(manifest.assets || {});
  await verifyManifestAssets(manifest, assets);
  vendorVerified = true;
  log(`Verified ${assets.length} browser vendor asset(s) against ${VENDOR_MANIFEST}.`);
}

async function ensureEngineVerified() {
  if (engineVerified) return;
  const releaseManifest = await ensureTrustedReleaseVerified();
  if (releaseManifest) {
    engineVerified = true;
    log('Trusted release manifest covers Singular engine assets.');
    return;
  }
  const manifest = await loadManifest(ENGINE_MANIFEST);
  const assets = EXPECTED_ENGINE_ASSETS;
  requireManifestAssets(manifest, assets, ENGINE_MANIFEST);
  await verifyManifestAssets(manifest, assets);
  engineVerified = true;
  log(`Verified ${assets.length} Singular engine asset(s) against ${ENGINE_MANIFEST}.`);
}

function setSelectedPath(path) {
  selectedPath = normalizePath(path || selectedPath);
  el.pathInput.value = selectedPath;
  el.selectedPath.textContent = selectedPath;
  refreshEditorHighlight();
}

function shouldHighlightEditor() {
  return /\.(?:lib|sing)$/i.test(normalizePath(el.pathInput.value || selectedPath));
}

function getArgs({ batch = false } = {}) {
  const args = batch ? ['-q'] : [];
  if (el.argNoRc.checked) args.push('--no-rc');
  if (batch && el.argNoShell.checked) args.push('--no-shell');
  if (batch) args.push('--no-tty');
  return args;
}

function terminalCtor() {
  return window.Terminal?.Terminal || window.Terminal;
}

function fitCtor() {
  return window.FitAddon?.FitAddon || window.FitAddon;
}

async function loadPtyModule() {
  if (!ptyModulePromise) {
    await ensureVendorVerified();
    ptyModulePromise = import('../vendor/xterm-pty/index.mjs');
  }
  const mod = await ptyModulePromise;
  const api = {
    openpty: mod.openpty || window.openpty,
    TtyServer: mod.TtyServer || window.TtyServer
  };
  if (typeof api.openpty !== 'function') {
    throw new Error('xterm-pty did not provide openpty(). Re-run scripts/fetch-web-deps.sh.');
  }
  if (typeof api.TtyServer !== 'function') {
    throw new Error('xterm-pty did not provide TtyServer. Use the pinned xterm-pty version from scripts/fetch-web-deps.sh.');
  }
  return api;
}

function ensureTerminal() {
  if (terminal) return terminal;
  const Terminal = terminalCtor();
  if (!Terminal) {
    throw new Error('xterm.js is missing. Run scripts/fetch-web-deps.sh or place xterm.js in public/vendor/xterm/.');
  }
  terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    disableStdin: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 14,
    scrollback: 7000,
    tabStopWidth: 2,
    theme: { background: '#111111' }
  });
  const FitAddon = fitCtor();
  if (FitAddon) {
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
  }
  terminalDataDisposable = terminal.onData?.(noteTerminalData) || null;
  terminal.attachCustomKeyEventHandler?.(event => {
    if (event.type !== 'keydown') return true;
    if (handleTerminalEditingKey(event)) {
      event.preventDefault();
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return true;
    if (event.key === 'ArrowUp') {
      if (!navigateTerminalHistory(-1)) return true;
      event.preventDefault();
      return false;
    }
    if (event.key === 'ArrowDown') {
      if (!navigateTerminalHistory(1)) return true;
      event.preventDefault();
      return false;
    }
    return true;
  });
  terminal.open(el.terminalBox);
  terminalKeydownHandler = handleTerminalKeydownCapture;
  terminalPasteHandler = handleTerminalPasteCapture;
  el.terminalBox.addEventListener('keydown', terminalKeydownHandler, true);
  el.terminalBox.addEventListener('paste', terminalPasteHandler, true);
  fitAddon?.fit?.();
  terminalResizeHandler = () => fitAddon?.fit?.();
  window.addEventListener('resize', terminalResizeHandler);
  return terminal;
}

function resetTerminal() {
  try { terminalDataDisposable?.dispose?.(); } catch (_) { /* noop */ }
  if (terminalResizeHandler) window.removeEventListener('resize', terminalResizeHandler);
  if (terminalKeydownHandler) el.terminalBox.removeEventListener('keydown', terminalKeydownHandler, true);
  if (terminalPasteHandler) el.terminalBox.removeEventListener('paste', terminalPasteHandler, true);
  try { terminal?.dispose?.(); } catch (_) { /* noop */ }
  terminal = null;
  fitAddon = null;
  terminalDataDisposable = null;
  terminalResizeHandler = null;
  terminalKeydownHandler = null;
  terminalPasteHandler = null;
  el.terminalBox.textContent = '';
}

function postControl(targetWorker, type, payload = {}, transfer = []) {
  targetWorker.postMessage({ [CONTROL]: true, type, ...payload }, transfer);
}

function requestWorkerControl(type, payload = {}, transfer = [], { timeoutMs = SESSION_FS_TIMEOUT_MS } = {}) {
  if (!worker) return Promise.reject(new Error('No Singular session is running.'));
  const requestId = ++workerRequestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingWorkerRequests.delete(requestId);
      reject(new Error(`${type} timed out.`));
    }, timeoutMs);
    pendingWorkerRequests.set(requestId, { resolve, reject, timer });
    postControl(worker, type, { requestId, ...payload }, transfer);
  });
}

function settleWorkerRequest(message) {
  const requestId = message?.requestId;
  if (!requestId) return false;
  const pending = pendingWorkerRequests.get(requestId);
  if (!pending) return false;
  pendingWorkerRequests.delete(requestId);
  clearTimeout(pending.timer);
  if (message.type === 'error') pending.reject(new Error(message.message || 'Filesystem request failed.'));
  else pending.resolve(message);
  return true;
}

function rejectPendingWorkerRequests(reason = 'Singular session stopped.') {
  for (const pending of pendingWorkerRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
  }
  pendingWorkerRequests.clear();
}

function terminalRowsText() {
  return Array.from(el.terminalBox.querySelectorAll('.xterm-rows > div'))
    .map(row => row.textContent)
    .join('\n');
}

function terminalBufferText() {
  const buffer = terminal?.buffer?.active;
  if (!buffer) return '';
  const lines = [];
  for (let i = 0; i < buffer.length; i += 1) {
    lines.push(buffer.getLine(i)?.translateToString(true) || '');
  }
  return lines.join('\n');
}

function terminalAtPrompt() {
  const lines = terminalBufferText().split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line === '>') return true;
    if (/(?:^|\s)(?:\.\s*)+>$/.test(line)) return true;
    return false;
  }
  return false;
}

function terminalDebugState() {
  return {
    hasTerminalPaste: typeof terminal?.paste === 'function',
    hasTerminalInput: typeof terminal?.input === 'function',
    hasTerminalDataEvent: typeof terminal?._core?.coreService?.triggerDataEvent === 'function',
    hasPtyMasterInput: typeof ptyMaster?.ldisc?.writeFromLower === 'function',
    terminalInputMethod,
    hasPtySlave: Boolean(ptySlave),
    hasWorker: Boolean(worker),
    ptyServerState: ptyServer?.state || null,
    ptyServerInputBuffered: ptyServer?.toWorkerBuf?.length ?? null,
    ptySlaveReadable: ptySlave?.readable ?? null,
    ptySlaveBuffered: ptySlave?.fromLdiscToUpperBuffer?.length ?? null,
    rows: terminalRowsText(),
    buffer: terminalBufferText()
  };
}

async function waitForTerminalInputReady(timeoutMs = 8000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (ptyServer?.state === 'input' && terminalAtPrompt()) return true;
    await delay(100);
  }
  return false;
}

async function waitForTerminalCommandComplete(previousBuffer, timeoutMs = 8000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    await delay(40);
    if (terminalBufferText() !== previousBuffer && terminalAtPrompt()) return true;
  }
  return false;
}

function writePtyServerInput(text) {
  if (!ptyServer) return false;
  const bytes = Array.from(new TextEncoder().encode(String(text || '').replace(/\r?\n/g, '\n')));
  ptyServer.toWorkerBuf.push(...bytes);
  if (ptyServer.state === 'input') ptyServer.feedToWorker(bytes.length);
  scrollTerminalToBottomSoon();
  return true;
}

function echoProgrammaticTerminalInput(text) {
  const value = String(text || '');
  if (!value) return;
  clearTerminalInputLine();
  terminal?.write?.(value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n'));
  scrollTerminalToBottomSoon();
}

function selectTerminalInputBridge() {
  terminalInputWriter = null;
  terminalInputMethod = '';

  if (typeof ptyMaster?.ldisc?.writeFromLower === 'function') {
    terminalInputMethod = 'PTY line discipline';
    terminalInputWriter = text => {
      const value = String(text || '');
      clearTerminalInputLine();
      ptyMaster.ldisc.writeFromLower(value.replace(/\r?\n/g, '\r'));
      scrollTerminalToBottomSoon();
      return true;
    };
    return;
  }

  if (ptyServer) {
    terminalInputMethod = 'PTY server feed';
    terminalInputWriter = text => {
      const value = String(text || '');
      echoProgrammaticTerminalInput(value);
      return writePtyServerInput(value);
    };
  }
}

async function workspacePayload() {
  const files = await listFiles();
  return files.map(record => ({
    path: record.path,
    mime: record.mime || 'application/octet-stream',
    data: record.data
  }));
}

function sessionMeta(file) {
  return {
    size: Number(file?.size || file?.data?.byteLength || 0),
    mtimeMs: Number(file?.mtimeMs || 0)
  };
}

function sameSessionMeta(a, b) {
  if (!a || !b) return false;
  if (Number(a.size) !== Number(b.size)) return false;
  if (!a.mtimeMs || !b.mtimeMs) return true;
  return Number(a.mtimeMs) === Number(b.mtimeMs);
}

function markPendingSessionBaselines(files) {
  for (const file of files) pendingSessionBaselines.add(normalizePath(file.path));
}

function markSessionBaseline(path, meta) {
  const normalized = normalizePath(path);
  pendingSessionBaselines.delete(normalized);
  sessionBaselines.set(normalized, sessionMeta(meta || sessionFiles.get(normalized)));
}

function sessionVersionChanged(path, workspaceRecord, sessionRecord) {
  if (!sessionRecord) return false;
  const baseline = sessionBaselines.get(normalizePath(path));
  if (baseline) return !sameSessionMeta(baseline, sessionRecord);
  if (!workspaceRecord) return false;
  return Number(sessionRecord.size) !== Number(workspaceRecord.data?.byteLength || 0);
}

function updateSessionFile(file) {
  if (!file?.path) return;
  const path = normalizePath(file.path);
  const existing = sessionFiles.get(path) || {};
  const data = file.data instanceof ArrayBuffer ? file.data : existing.data;
  const record = {
    ...existing,
    path,
    size: Number(file.size ?? data?.byteLength ?? existing.size ?? 0),
    mtimeMs: Number(file.mtimeMs || existing.mtimeMs || 0)
  };
  if (data) record.data = data;
  sessionFiles.set(path, record);
  if (pendingSessionBaselines.has(path)) markSessionBaseline(path, record);
}

function deleteSessionFile(path) {
  const normalized = normalizePath(path);
  sessionFiles.delete(normalized);
  sessionBaselines.delete(normalized);
  pendingSessionBaselines.delete(normalized);
}

async function listMergedFiles() {
  const workspaceRecords = await listFiles();
  const byPath = new Map();
  for (const record of workspaceRecords) {
    byPath.set(record.path, { path: record.path, workspaceRecord: record });
  }
  for (const sessionRecord of sessionFiles.values()) {
    const existing = byPath.get(sessionRecord.path) || { path: sessionRecord.path };
    existing.sessionRecord = sessionRecord;
    byPath.set(sessionRecord.path, existing);
  }
  const entries = Array.from(byPath.values()).map(entry => {
    const sessionOnly = Boolean(entry.sessionRecord && !entry.workspaceRecord);
    const sessionModified = Boolean(
      entry.sessionRecord &&
      entry.workspaceRecord &&
      sessionVersionChanged(entry.path, entry.workspaceRecord, entry.sessionRecord)
    );
    return {
      ...entry,
      sessionOnly,
      sessionModified,
      size: entry.sessionRecord?.size ?? entry.workspaceRecord?.data?.byteLength ?? 0
    };
  });
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function startSessionFileTracking() {
  refreshFileList();
}

function stopSessionFileTracking() {
  sessionFiles.clear();
  sessionBaselines.clear();
  pendingSessionBaselines.clear();
}

async function readSessionFile(path) {
  const normalized = normalizePath(path);
  const liveRecord = sessionFiles.get(normalized);
  if (!liveRecord?.data) throw new Error(`${normalized} has not been captured from the live session yet.`);
  const data = liveRecord.data;
  const record = {
    path: normalized,
    data,
    mime: textExtension(normalized) ? 'text/plain;charset=utf-8' : 'application/octet-stream',
    updatedAt: Date.now(),
    source: 'session',
    size: Number(liveRecord.size ?? data.byteLength),
    mtimeMs: Number(liveRecord.mtimeMs || 0)
  };
  return record;
}

async function importSessionFileToWorkspace(path) {
  const record = await readSessionFile(path);
  await putFile(record.path, record.data, {
    mime: record.mime,
    updatedAt: Date.now(),
    source: 'session'
  });
  markSessionBaseline(record.path, record);
  return record;
}

async function readFileForOutput(path) {
  const normalized = normalizePath(path);
  if (worker) {
    try {
      return await readSessionFile(normalized);
    } catch (error) {
      if (sessionFiles.has(normalized)) log(`Could not read live ${normalized}: ${error.message || String(error)}`);
    }
  }
  return getFile(normalized);
}

async function sendWorkspaceToWorker(targetWorker) {
  const files = await workspacePayload();
  if (targetWorker === worker && ptyServer) {
    log('Saved browser workspace only. Running-session filesystem sync is disabled while Singular owns the worker.');
    return;
  }
  const transfer = files.map(file => file.data).filter(Boolean);
  markPendingSessionBaselines(files);
  if (targetWorker === worker) {
    await requestWorkerControl('fs.writeMany', { files }, transfer);
  } else {
    postControl(targetWorker, 'fs.writeMany', { files }, transfer);
  }
  log(`Synced ${files.length} workspace file(s) into the running WASM filesystem.`);
}

async function refreshFileList() {
  const files = await listMergedFiles();
  const filter = el.fileFilter.value.trim().toLowerCase();
  const visible = filter ? files.filter(file => file.path.toLowerCase().includes(filter)) : files;
  const workspaceCount = files.filter(file => file.workspaceRecord).length;
  const liveOnlyCount = files.filter(file => file.sessionOnly).length;
  el.fileCount.textContent = `${workspaceCount} workspace file${workspaceCount === 1 ? '' : 's'}${liveOnlyCount ? `, ${liveOnlyCount} live file${liveOnlyCount === 1 ? '' : 's'}` : ''}`;
  el.fileList.textContent = '';
  for (const file of visible) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const label = document.createElement('span');
    const badges = document.createElement('span');
    button.type = 'button';
    label.className = 'file-path';
    label.textContent = file.path;
    badges.className = 'file-badges';
    if (file.sessionOnly) {
      const badge = document.createElement('span');
      badge.className = 'file-badge live';
      badge.textContent = 'live';
      badges.append(badge);
    } else if (file.sessionModified) {
      const badge = document.createElement('span');
      badge.className = 'file-badge modified';
      badge.textContent = 'modified';
      badges.append(badge);
    }
    button.append(label, badges);
    button.title = `${file.path}\n${Math.round((file.size || 0) / 1024)} KB${file.sessionOnly ? '\nLive session file; opening imports it into the browser workspace.' : ''}${file.sessionModified ? '\nLive session version differs; opening imports it into the browser workspace.' : ''}`;
    button.setAttribute('aria-current', file.path === selectedPath ? 'true' : 'false');
    button.addEventListener('click', () => runAction('Open file', () => loadFileIntoEditor(file.path)));
    li.append(button);
    el.fileList.append(li);
  }
}

async function loadFileIntoEditor(path) {
  const normalized = normalizePath(path);
  let record = await getFile(normalized);
  if (worker && sessionFiles.has(normalized)) {
    try {
      record = await importSessionFileToWorkspace(normalized);
    } catch (error) {
      log(`Could not open live ${normalized}: ${error.message || String(error)}`);
    }
  }
  if (!record) return;
  setSelectedPath(normalized);
  if (textExtension(normalized)) {
    setEditorValue(decodeText(record.data));
  } else {
    setEditorValue(`/* Binary file selected: ${normalized}\n   Size: ${record.data?.byteLength || 0} bytes\n   Use Download to save it. */\n`);
  }
  await refreshFileList();
}

async function ensureExampleFile() {
  const existing = await getFile('/workspace/example.sing');
  if (!existing) {
    await putText('/workspace/example.sing', DEFAULT_SCRIPT, { source: 'example' });
  } else if (PREVIOUS_DEFAULT_SCRIPTS.includes(decodeText(existing.data))) {
    await putText('/workspace/example.sing', DEFAULT_SCRIPT, { source: 'example' });
  }
  await loadFileIntoEditor('/workspace/example.sing');
}

async function saveEditor() {
  const path = normalizePath(el.pathInput.value || selectedPath);
  await putText(path, el.editor.value, { source: 'editor' });
  setSelectedPath(path);
  await refreshFileList();
  log(worker ? `Saved ${path} to browser workspace. Restart Singular to copy it into the running filesystem.` : `Saved ${path}.`);
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    const path = normalizePath(file.webkitRelativePath || file.name);
    await putFile(path, await file.arrayBuffer(), {
      mime: file.type || 'application/octet-stream',
      updatedAt: file.lastModified || Date.now(),
      source: 'upload'
    });
  }
  await refreshFileList();
  log(worker
    ? `Uploaded ${files.length} file(s) into browser workspace. Restart Singular to copy them into the running filesystem.`
    : `Uploaded ${files.length} file(s) into /workspace.`);
}

async function downloadSelectedFile() {
  const path = normalizePath(el.pathInput.value || selectedPath);
  const record = await readFileForOutput(path);
  if (!record) {
    log(`No file at ${path}.`);
    return;
  }
  downloadBlob(new Blob([record.data], { type: record.mime || 'application/octet-stream' }), basename(path));
}

async function deleteSelectedFile() {
  const path = normalizePath(el.pathInput.value || selectedPath);
  await deleteFile(path);
  if (sessionFiles.has(path)) log(`Deleted ${path} from browser workspace. The live session copy remains until Singular stops.`);
  else log(`Deleted ${path}.`);
  await refreshFileList();
}

async function exportWorkspace() {
  const json = await exportWorkspaceJson();
  downloadBlob(new Blob([json], { type: 'application/json' }), `singular-workspace-${Date.now()}.json`);
}

async function importWorkspace(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_JSON_BYTES) {
    log(`Workspace JSON is too large (${Math.round(file.size / 1024 / 1024)} MB).`);
    return;
  }
  const count = await importWorkspaceJson(await file.text());
  await refreshFileList();
  if (worker) {
    await sendWorkspaceToWorker(worker);
  }
  log(`Imported ${count} file(s) from workspace JSON.`);
}

async function startSession() {
  if (worker || sessionStarting) {
    log('A Singular session is already running. Use Restart or Terminate first.');
    return;
  }
  sessionStarting = true;
  try {
    setStartupStage(1);
    await ensureEngineVerified();
    setStartupStage(2);
    const term = ensureTerminal();
    term.clear();
    resetTerminalCurrentLine();
    resetTerminalLineNavigation();
    setStartupStage(3);
    const pty = await loadPtyModule();
    const pair = pty.openpty();
    ptyMaster = pair.master;
    ptySlave = pair.slave;
    term.loadAddon(ptyMaster);

    setStartupStage(4);
    worker = new Worker('workers/singular-terminal-worker.js', { name: 'singular-terminal-worker' });
    worker.addEventListener('message', event => handleWorkerMessage(event.data));
    worker.addEventListener('error', event => {
      log(`Terminal worker error: ${event.message}`);
      setStatus('error', 'Worker error');
      setStartButtonState('failed', 'Failed');
    });

    postControl(worker, 'configure', { args: getArgs({ batch: false }) });
    setStartupStage(5);
    await sendWorkspaceToWorker(worker);

    setStartupStage(6);
    ptyServer = new pty.TtyServer(ptySlave);
    ptyServer.start(worker);
    selectTerminalInputBridge();
    startSessionFileTracking();
    setStatus('ready', 'Session running', 'interactive terminal');
    setStartButtonState('running', 'Running');
    sessionStarting = false;
    log('Started Singular terminal session.');
    log(terminalInputMethod ? `Terminal input bridge: ${terminalInputMethod}.` : 'Terminal input bridge is not available.');
  } catch (error) {
    sessionStarting = false;
    terminateSession({ silent: true });
    setStatus('error', 'Could not start', error.message || String(error));
    setStartButtonState('failed', 'Failed');
    log(`Start failed: ${error.message || String(error)}`);
  }
}

function terminateSession({ silent = false } = {}) {
  try { ptyServer?.close?.(); } catch (_) { /* noop */ }
  try { ptyMaster?.dispose?.(); } catch (_) { /* noop */ }
  try { ptySlave?.dispose?.(); } catch (_) { /* noop */ }
  try { worker?.terminate?.(); } catch (_) { /* noop */ }
  sessionStarting = false;
  worker = null;
  ptyServer = null;
  ptyMaster = null;
  ptySlave = null;
  terminalInputWriter = null;
  terminalInputMethod = '';
  resetTerminalCurrentLine();
  resetTerminalLineNavigation();
  stopSessionFileTracking();
  rejectPendingWorkerRequests();
  if (!silent) log('Terminated Singular session.');
  setStatus('', 'Not started');
  setStartButtonState('', 'Start');
  refreshFileList();
}

async function restartSession() {
  terminateSession({ silent: true });
  resetTerminal();
  await startSession();
}

function selectedTutorial() {
  const tutorials = currentTutorialList();
  const index = Math.max(0, Math.min(tutorials.length - 1, Number(el.tutorialSelect.value || 0)));
  return tutorials[index] || null;
}

function appendTutorialToEditor() {
  const tutorial = selectedTutorial();
  const code = tutorialCodeText(tutorial).trimEnd();
  if (!tutorial || !code) {
    log('No tutorial code to append.');
    return;
  }
  const current = el.editor.value.replace(/\s+$/, '');
  const next = current ? `${current}\n\n${code}\n` : `${code}\n`;
  setWorkbenchTab('editor');
  setEditorValue(next, { focus: true });
  log(`Appended tutorial "${tutorial.title}" to the editor.`);
}

async function sendTerminalChunks(chunks, description) {
  if (!worker || !ptySlave) {
    log('No terminal session. Start Singular first.');
    return;
  }
  if (!terminalInputWriter) {
    log('Terminal input bridge is not available in this session.');
    return;
  }
  if (!await waitForTerminalInputReady()) {
    log('Terminal is not ready for input yet; wait for the Singular prompt and try again.');
    return;
  }
  const codeChunks = chunks
    .map(chunk => String(chunk || '').replace(/\s+$/, ''))
    .filter(chunk => chunk.trim());
  if (!codeChunks.length) {
    log(`No ${description} to send.`);
    return;
  }
  let sent = 0;
  let sentLines = 0;
  for (const chunk of codeChunks) {
    if (!await waitForTerminalInputReady()) {
      log(`Stopped sending ${description}; terminal did not return to a prompt.`);
      break;
    }
    const before = terminalBufferText();
    if (!writeTerminalInput(`${chunk}\n`)) break;
    rememberTerminalCommands(chunk);
    sent += 1;
    sentLines += chunk.split(/\r?\n/).filter(line => line.trim()).length;
    resetTerminalCurrentLine();
    resetTerminalLineNavigation();
    await waitForTerminalCommandComplete(before);
  }
  if (sent) {
    const detail = sent === sentLines ? `${sent} ${sent === 1 ? 'line' : 'lines'}` : `${sentLines} lines in ${sent} steps`;
    log(`Sent ${detail} of ${description} to the terminal via ${terminalInputMethod}.`);
  }
}

async function sendCodeToTerminal(code, description) {
  const lines = String(code || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim());
  await sendTerminalChunks(lines, description);
}

async function sendEditorToTerminal() {
  await sendCodeToTerminal(el.editor.value, 'editor contents');
}

async function sendTutorialCode(index) {
  const step = currentTutorialSteps[index];
  if (!step?.code) {
    log('Tutorial code step is empty.');
    return;
  }
  await sendTerminalChunks([tutorialStepTerminalCode(step)], `tutorial lines ${step.lineLabel}`);
}

async function pasteTutorialAll() {
  const tutorial = selectedTutorial();
  if (!tutorial) {
    log('No tutorial selected.');
    return;
  }
  const steps = tutorialStatementSteps(tutorial).map(tutorialStepTerminalCode);
  await sendTerminalChunks(steps, `tutorial "${tutorial.title}"`);
}

function writeTerminalInput(text, { quiet = false } = {}) {
  try {
    if (!terminalInputWriter) return false;
    terminalInputWriter(text);
    return true;
  } catch (error) {
    if (!quiet) log(`Could not send terminal input: ${error.message || String(error)}`);
    return false;
  }
}

async function loadSelectedLib() {
  const path = normalizePath(el.pathInput.value || selectedPath);
  await saveEditor();
  if (!worker || !ptySlave) {
    log('Library saved. Start a terminal session to load it.');
    return;
  }
  if (!terminalInputWriter) {
    log('Library saved, but terminal input bridge is not available in this session.');
    return;
  }
  if (!await waitForTerminalInputReady()) {
    log('Library saved, but the terminal is not ready for input yet.');
    return;
  }
  const command = `LIB "${path}";\n`;
  if (writeTerminalInput(command)) {
    rememberTerminalCommands(command);
    resetTerminalCurrentLine();
    resetTerminalLineNavigation();
    log(`Sent LIB command for ${path} via ${terminalInputMethod}.`);
  }
}

function handleWorkerMessage(message) {
  if (!message || !message[CONTROL]) return;
  if (settleWorkerRequest(message)) return;
  if (message.type === 'ready') {
    setStatus('ready', 'Session running', message.detail || 'runtime ready');
  } else if (message.type === 'fs.ack') {
    log(message.detail || 'Filesystem operation completed.');
  } else if (message.type === 'fs.list') {
    for (const file of message.files || []) updateSessionFile(file);
    refreshFileList();
  } else if (message.type === 'fs.changed') {
    updateSessionFile(message.file);
    refreshFileList();
  } else if (message.type === 'fs.deleted') {
    deleteSessionFile(message.path);
    refreshFileList();
  } else if (message.type === 'error') {
    log(`Runtime: ${message.message || 'unknown error'}`);
  } else if (message.type === 'metrics') {
    const totalMs = message.metrics?.totalMs;
    log(totalMs == null ? `Runtime metrics: ${JSON.stringify(message.metrics)}` : `Runtime total: ${formatRuntimeMs(totalMs)}.`);
  }
}

async function runBatch({ benchmark = false } = {}) {
  await saveEditor();
  await ensureEngineVerified();
  const scriptPath = normalizePath(el.pathInput.value || selectedPath);
  const files = await workspacePayload();
  const transfer = files.map(file => file.data).filter(Boolean);
  const timeoutMs = Math.max(1, Number(el.batchTimeout.value || 20)) * 1000;
  const batchWorker = new Worker('workers/singular-batch-worker.js', { name: 'singular-batch-worker' });
  const startedAt = performance.now();
  setStatus('busy', benchmark ? 'Benchmarking' : 'Running script', scriptPath);
  log(`${benchmark ? 'Benchmark' : 'Batch run'} started: ${scriptPath}`);

  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    finished = true;
    batchWorker.terminate();
    setStatus('error', 'Batch timed out', `timeout ${timeoutMs / 1000} sec`);
    log(`Batch worker terminated after timeout ${timeoutMs / 1000} sec.`);
  }, timeoutMs);

  batchWorker.addEventListener('message', event => {
    const msg = event.data || {};
    if (msg.type === 'stdout' || msg.type === 'stderr') {
      el.output.textContent += msg.text || '';
      el.output.scrollTop = el.output.scrollHeight;
    } else if (msg.type === 'phase') {
      log(msg.name);
    } else if (msg.type === 'metrics') {
      const totalMs = msg.metrics?.totalMs;
      log(totalMs == null ? `Batch metrics: ${JSON.stringify(msg.metrics)}` : `Batch runtime: ${formatRuntimeMs(totalMs)}.`);
    } else if (msg.type === 'done') {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - startedAt);
      setStatus(msg.exitCode === 0 ? 'ready' : 'error', `Batch finished`, `exit ${msg.exitCode}, ${formatRuntimeMs(elapsed)}`);
      log(`Batch finished with exit ${msg.exitCode} in ${formatRuntimeMs(elapsed)}.`);
      batchWorker.terminate();
    }
  });
  batchWorker.addEventListener('error', event => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    setStatus('error', 'Batch worker error');
    log(`Batch worker error: ${event.message}`);
    batchWorker.terminate();
  });

  batchWorker.postMessage({
    type: 'run',
    args: getArgs({ batch: true }),
    scriptPath,
    files,
    benchmark
  }, transfer);
}

async function benchmark() {
  const sample = `ring r = 0,(x,y,z),dp;\nideal I = x2+y2+z2, x*y-z, y*z-x;\ntimer = 1;\nstd(I);\n`; // modest by design
  setSelectedPath('/workspace/benchmark.sing');
  setEditorValue(sample);
  await runBatch({ benchmark: true });
}

function clearTerminal() {
  terminal?.clear?.();
}

async function copyOutput() {
  if (!navigator.clipboard?.writeText) {
    log('Clipboard writing is not available in this browser.');
    return;
  }
  await navigator.clipboard.writeText(el.output.textContent);
  log('Copied output log.');
}

async function openLocalFolder() {
  if (!('showDirectoryPicker' in window)) {
    el.folderStatus.textContent = 'File System Access API is not available in this browser.';
    return;
  }
  folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  el.folderStatus.textContent = `Selected: ${folderHandle.name}`;
}

async function pullLocalFolder() {
  if (!folderHandle) await openLocalFolder();
  if (!folderHandle) return;
  const imported = await readDirectoryIntoWorkspace(folderHandle, '/workspace');
  await refreshFileList();
  if (worker) await sendWorkspaceToWorker(worker);
  log(`Pulled ${imported} file(s) from selected local folder.`);
}

async function readDirectoryIntoWorkspace(handle, prefix) {
  let count = 0;
  for await (const [name, child] of handle.entries()) {
    if (name.startsWith('.')) continue;
    const path = `${prefix}/${name}`;
    if (child.kind === 'file') {
      const file = await child.getFile();
      if (file.size > MAX_PULL_FILE_BYTES) {
        log(`Skipped large file ${path} (${Math.round(file.size / 1024 / 1024)} MB).`);
        continue;
      }
      await putFile(path, await file.arrayBuffer(), {
        mime: file.type || 'application/octet-stream',
        updatedAt: file.lastModified || Date.now(),
        source: 'local-folder'
      });
      count += 1;
    } else if (child.kind === 'directory') {
      count += await readDirectoryIntoWorkspace(child, path);
    }
  }
  return count;
}

async function pushWorkspaceToFolder() {
  if (!folderHandle) await openLocalFolder();
  if (!folderHandle) return;
  const files = await listMergedFiles();
  if (!window.confirm(`Write ${files.length} file(s) to "${folderHandle.name}"? Existing files with the same names may be overwritten.`)) {
    log('Push to local folder cancelled.');
    return;
  }
  for (const file of files) {
    const record = await readFileForOutput(file.path);
    if (!record) {
      log(`Skipped ${file.path}; no readable workspace or session file.`);
      continue;
    }
    await writeRecordToFolder(folderHandle, record);
  }
  log(`Pushed ${files.length} file(s) to selected local folder.`);
}

async function writeRecordToFolder(root, record) {
  const rel = normalizePath(record.path).replace(/^\/workspace\/?/, '');
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return;
  let dir = root;
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(record.data);
  await writable.close();
}

async function checkEngineAssets() {
  try {
    const manifest = await loadManifest(ENGINE_MANIFEST);
    const count = Object.keys(manifest.assets).filter(path => path.startsWith('engine/Singular.')).length;
    if (!manifest.assets['engine/Singular.js']) throw new Error('engine/Singular.js is missing from manifest');
    const trustDetail = hasTrustedReleaseConfig() ? '; GitHub release check configured' : '';
    setStatus('ready', 'Ready', `${count} engine asset hash${count === 1 ? '' : 'es'} verified${trustDetail}`);
  } catch (error) {
    setStatus('error', 'Engine missing', 'build or copy Singular.js/.wasm/.data');
    log(`Engine manifest not ready: ${error.message || String(error)}`);
  }
}

function setButtonShortcut(button, item) {
  if (!button || !item) return;
  const baseLabel = button.dataset.label || button.textContent.trim();
  button.dataset.label = baseLabel;
  button.textContent = '';
  const label = document.createElement('span');
  label.className = 'button-label';
  label.textContent = baseLabel;
  const key = document.createElement('kbd');
  key.className = 'shortcut';
  key.textContent = button.closest('.button-grid.compact') ? item.compactLabel : item.label;
  key.title = item.label;
  button.append(label, key);
  button.title = `${baseLabel} (${item.label})`;
  button.setAttribute('aria-keyshortcuts', item.aria);
}

function normalizeEventKey(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

function matchesShortcut(event, item) {
  if (!item) return false;
  if (event.defaultPrevented || event.repeat) return false;
  if (Boolean(event[PRIMARY_MODIFIER]) !== Boolean(item.primary)) return false;
  if (IS_APPLE_PLATFORM && event.ctrlKey) return false;
  if (!IS_APPLE_PLATFORM && event.metaKey) return false;
  if (Boolean(event.altKey) !== Boolean(item.alt)) return false;
  if (Boolean(event.shiftKey) !== Boolean(item.shift)) return false;
  return normalizeEventKey(event) === item.key;
}

function runAction(name, action) {
  try {
    const result = action();
    if (result?.catch) {
      result.catch(error => log(`${name} failed: ${error.message || String(error)}`));
    }
  } catch (error) {
    log(`${name} failed: ${error.message || String(error)}`);
  }
}

function bindButton(name, action) {
  const button = el.buttons[name];
  const item = SHORTCUTS[name];
  setButtonShortcut(button, item);
  button.addEventListener('click', () => runAction(button.dataset.label || name, action));
  return { name, action, shortcut: item };
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('sw.js', { scope: './' }); } catch (_) { /* optional */ }
}

function wireEvents() {
  const actions = [
    bindButton('newFile', () => {
      const suggested = `/workspace/untitled-${Date.now()}.sing`;
      setSelectedPath(suggested);
      setEditorValue('', { focus: true });
    }),
    bindButton('upload', () => el.fileInput.click()),
    bindButton('download', downloadSelectedFile),
    bindButton('delete', deleteSelectedFile),
    bindButton('openFolder', openLocalFolder),
    bindButton('pullFolder', pullLocalFolder),
    bindButton('pushFolder', pushWorkspaceToFolder),
    bindButton('exportWorkspace', exportWorkspace),
    bindButton('importWorkspace', () => el.jsonInput.click()),
    bindButton('saveEditor', saveEditor),
    bindButton('sendEditor', sendEditorToTerminal),
    bindButton('runBatch', () => runBatch()),
    bindButton('loadLib', loadSelectedLib),
    bindButton('start', startSession),
    bindButton('restart', restartSession),
    bindButton('terminate', terminateSession),
    bindButton('clearTerminal', clearTerminal),
    bindButton('benchmark', benchmark),
    bindButton('copyOutput', copyOutput)
  ];

  el.fileInput.addEventListener('change', () => uploadFiles(el.fileInput.files));
  el.fileFilter.addEventListener('input', refreshFileList);
  el.pathInput.addEventListener('change', () => setSelectedPath(el.pathInput.value));
  el.jsonInput.addEventListener('change', () => importWorkspace(el.jsonInput.files?.[0]));
  el.editor.addEventListener('input', refreshEditorHighlight);
  el.editor.addEventListener('scroll', refreshEditorHighlight);
  el.tabEditor.addEventListener('click', () => setWorkbenchTab('editor'));
  el.tabTutorials.addEventListener('click', () => setWorkbenchTab('tutorials'));
  el.tutorialCategory.addEventListener('change', () => {
    renderTutorialOptions();
    renderTutorial();
  });
  el.tutorialSelect.addEventListener('change', renderTutorial);
  el.tutorialAppendEditor.addEventListener('click', () => runAction('Append tutorial to editor', appendTutorialToEditor));
  el.tutorialPasteAll.addEventListener('click', () => runAction('Paste tutorial all', pasteTutorialAll));
  el.tutorialMultiline.addEventListener('change', renderTutorial);
  window.addEventListener('resize', () => requestAnimationFrame(updateTutorialLineOverflow));

  document.addEventListener('keydown', event => {
    for (const action of actions) {
      if (matchesShortcut(event, action.shortcut)) {
        event.preventDefault();
        runAction(action.name, action.action);
        break;
      }
    }
  });
}

async function main() {
  wireEvents();
  renderTutorialCategories();
  renderTutorialOptions();
  renderTutorial();
  refreshEditorHighlight();
  await ensureExampleFile();
  await refreshFileList();
  await checkEngineAssets();
  const api = {
    startSession,
    terminateSession,
    runBatch,
    benchmark,
    sendEditorToTerminal,
    sendTutorialCode,
    appendTutorialToEditor,
    pasteTutorialAll,
    tutorialSteps: () => currentTutorialSteps,
    tutorials: TUTORIALS,
    tutorialCategories: TUTORIAL_CATEGORY_LIST,
    shortcuts: SHORTCUTS,
    listFiles,
    listVisibleFiles: listMergedFiles,
    sendWorkspaceToWorker: () => worker ? sendWorkspaceToWorker(worker) : Promise.resolve()
  };
  if (new URLSearchParams(location.search).has('keyboard-smoke')) {
    api.debugState = terminalDebugState;
    api.debugSendTerminalInput = (method, text) => {
      const value = String(text || '');
      const before = terminalDebugState();
      if (method === 'pty-slave-write') {
        ptySlave?.write?.(value);
      } else if (method === 'pty-master-lf') {
        ptyMaster?.ldisc?.writeFromLower?.(value.replace(/\r\n/g, '\n'));
      } else if (method === 'pty-master-cr') {
        ptyMaster?.ldisc?.writeFromLower?.(value.replace(/\r?\n/g, '\r'));
      } else if (method === 'xterm-data-event') {
        terminal?._core?.coreService?.triggerDataEvent?.(value.replace(/\r?\n/g, '\r'), true);
      } else if (method === 'xterm-input') {
        terminal?.input?.(value.replace(/\r?\n/g, '\r'));
      } else if (method === 'xterm-paste') {
        terminal?.paste?.(value);
      } else if (method === 'pty-server-feed') {
        writePtyServerInput(value);
      } else {
        throw new Error(`Unknown terminal input method: ${method}`);
      }
      return { before, after: terminalDebugState() };
    };
  }
  window.SINGULAR_WORKBENCH = api;
  registerServiceWorker();
}

main().catch(error => {
  setStatus('error', 'App error');
  log(error.stack || error.message || String(error));
});
