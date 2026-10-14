/**
 * El script completo contra un repo de juguete: los plugins que suma app.config.js
 * no están en app.json y solo se ven evaluando la config efectiva de cada lado.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'nativos-vs-base.mjs');
let repo;

const escribir = (ruta, contenido) => writeFileSync(path.join(repo, ruta), contenido);
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

function appConfig(pluginsExtra) {
  return `module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), ${pluginsExtra}],
});\n`;
}

function correr(canal) {
  const env = { ...process.env };
  delete env.APP_VARIANT;
  return spawnSync('node', [SCRIPT, canal, '--base', 'base'], { cwd: repo, env, encoding: 'utf8' });
}

before(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'nativos-vs-base-'));
  mkdirSync(path.join(repo, 'mobile'));
  git('init', '-q');
  escribir('mobile/package.json', JSON.stringify({ dependencies: {} }));
  escribir('mobile/app.json', JSON.stringify({ expo: { plugins: ['expo-router'] } }));
  escribir('mobile/app.config.js', appConfig("'expo-font'"));
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  git('tag', 'base');
});

after(() => rmSync(repo, { recursive: true, force: true }));

test('sin cambios de config sale con 0', () => {
  const res = correr('production');
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('un plugin agregado solo en app.config.js se detecta y sale con 1', () => {
  escribir('mobile/app.config.js', appConfig("'expo-font', 'expo-nuevo'"));
  const res = correr('production');
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /Config plugins agregados: expo-nuevo/);
  assert.match(res.stdout, /\+.*'expo-nuevo'/, 'muestra el diff de contenido');
});

test('un plugin condicional a la variante TEST solo cuenta para el canal test', () => {
  escribir(
    'mobile/app.config.js',
    appConfig("'expo-font', ...(process.env.APP_VARIANT === 'test' ? ['expo-solo-test'] : [])"),
  );
  assert.equal(correr('production').status, 0);
  const res = correr('test');
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /Config plugins agregados: expo-solo-test/);
});
