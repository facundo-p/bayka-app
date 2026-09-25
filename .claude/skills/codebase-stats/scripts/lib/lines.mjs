import { COMMENT_STYLE, LANGUAGES } from './config.mjs';

export const LINE_TYPE = Object.freeze({ code: 'code', comment: 'comment', blank: 'blank' });

const JSX_BRACES = /^[{}\s]*$/;

function startsAt(line, i, tokens) {
  return tokens.find((t) => line.startsWith(t, i));
}

// Avanza sobre un comentario de bloque; devuelve el índice siguiente y si sigue abierto.
function skipBlock(line, i, close) {
  const end = line.indexOf(close, i);
  return end === -1 ? { i: line.length, open: true } : { i: end + close.length, open: false };
}

function skipString(line, i, quote) {
  let j = i + 1;
  while (j < line.length && line[j] !== quote) j += line[j] === '\\' ? 2 : 1;
  return { i: j + 1, open: j >= line.length && quote === '`' };
}

function scanChar(line, i, style, state) {
  if (state.inBlock) return { ...skipBlock(line, i, style.block[1]), key: 'inBlock', comment: true };
  if (state.inTemplate) return { ...skipString(line, i - 1, '`'), key: 'inTemplate', code: true };
  if (startsAt(line, i, style.line)) return { i: line.length, comment: true };
  if (style.block && line.startsWith(style.block[0], i)) {
    return { ...skipBlock(line, i + style.block[0].length, style.block[1]), key: 'inBlock', comment: true };
  }
  const quote = startsAt(line, i, style.quotes);
  if (quote) return { ...skipString(line, i, quote), key: quote === '`' ? 'inTemplate' : null, code: true };
  return { i: i + 1, code: !/\s/.test(line[i]), text: line[i] };
}

// Clasifica una línea y devuelve el estado multilínea para la siguiente.
function scanLine(line, style, state) {
  let i = 0;
  let codeText = '';
  let sawComment = false;
  let next = { inBlock: state.inBlock, inTemplate: state.inTemplate };
  while (i < line.length) {
    const step = scanChar(line, i, style, next);
    if (step.key) next = { ...next, [step.key]: step.open };
    sawComment ||= Boolean(step.comment);
    if (step.code) codeText += step.text ?? 'x';
    i = step.i;
  }
  return { type: lineType(codeText, sawComment, style), state: next };
}

function lineType(codeText, sawComment, style) {
  if (!codeText && !sawComment) return LINE_TYPE.blank;
  if (!codeText) return LINE_TYPE.comment;
  if (sawComment && style.jsxBraces && JSX_BRACES.test(codeText)) return LINE_TYPE.comment;
  return LINE_TYPE.code;
}

// Una línea en blanco dentro de un bloque o template pertenece a lo que la envuelve.
function multilineType(state) {
  return state.inTemplate ? LINE_TYPE.code : LINE_TYPE.comment;
}

function emptyCounts() {
  return { code: 0, comment: 0, blank: 0 };
}

export function countLines(text, lang) {
  const style = COMMENT_STYLE[LANGUAGES[lang].comments];
  const counts = emptyCounts();
  let state = { inBlock: false, inTemplate: false };
  for (const line of splitLines(text)) {
    if (!line.trim() && !state.inBlock && !state.inTemplate) { counts.blank++; continue; }
    if (!style) { counts.code++; continue; }
    const res = scanLine(line, style, state);
    counts[res.type === LINE_TYPE.blank ? multilineType(state) : res.type]++;
    state = res.state;
  }
  return counts;
}

export function splitLines(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}
