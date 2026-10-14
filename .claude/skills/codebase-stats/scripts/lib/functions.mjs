import { createRequire } from 'node:module';
import { join } from 'node:path';

const ANONYMOUS = '<anónima>';

// Usa el compilador que ya instala mobile: el skill no suma dependencias.
export function loadTypescript(root) {
  return createRequire(join(root, 'mobile', 'package.json'))('typescript');
}

function scriptKind(ts, lang) {
  return lang === 'tsx' ? ts.ScriptKind.TSX : lang === 'js' ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
}

function isFunctionLike(ts, node) {
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)
    || ts.isFunctionExpression(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}

function nameOf(ts, node, source) {
  if (node.name) return node.name.getText(source);
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  const parent = node.parent;
  if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)
    || ts.isPropertyDeclaration(parent))) return parent.name.getText(source);
  // Callbacks: `useEffect(() => …)` se reporta como "useEffect(…)".
  if (parent && ts.isCallExpression(parent)) return `${parent.expression.getText(source).slice(0, 40)}(…)`;
  return ANONYMOUS;
}

function lineOf(source, pos) {
  return source.getLineAndCharacterOfPosition(pos).line + 1;
}

// Todas las funciones de un archivo con su largo en líneas (incluye las anidadas).
export function listFunctions(ts, text, path, lang) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(ts, lang));
  const found = [];
  const visit = (node) => {
    if (isFunctionLike(ts, node) && node.body) {
      const start = lineOf(source, node.getStart(source));
      found.push({ name: nameOf(ts, node, source), line: start, lines: lineOf(source, node.end) - start + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
