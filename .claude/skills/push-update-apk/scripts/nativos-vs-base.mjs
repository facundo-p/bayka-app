#!/usr/bin/env node
/**
 * ¿El JS del working tree necesita nativo que el APK del canal no tiene? (#678)
 *
 * Uso, desde la raíz del repo:
 *   node .claude/skills/push-update-apk/scripts/nativos-vs-base.mjs <test|production> [--base <ref>]
 *
 * Sale con 1 si hay módulos nativos o config plugins distintos al APK (el OTA no alcanza:
 * APK nuevo), con 0 si no, y con 2 si el uso es inválido.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  cambiosDePlugins,
  cambiosNativos,
  commitSinSufijo,
  MARCAS_NATIVAS,
  NATIVO,
} from './lib/nativos.mjs';

// Contrato con CANAL_OTA de mobile/app.config.js.
const CANAL = Object.freeze({ test: 'test', prod: 'production' });
const APK_TEST = 'mobile/build-output-test.apk';
const ARCHIVOS_CONFIG = ['mobile/package.json', 'mobile/app.json', 'mobile/app.config.js'];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function tagMobileEnMain() {
  return git('describe', '--tags', '--abbrev=0', '--match', 'mobile-v*', 'origin/main');
}

/** Commit del último APK TEST compilado en esta máquina, de su `extra.commit`; null si no hay. */
function commitDelApkTest() {
  if (!existsSync(APK_TEST)) return null;
  try {
    const config = JSON.parse(
      execFileSync('unzip', ['-p', APK_TEST, 'assets/app.config'], { encoding: 'utf8' }),
    );
    return config.extra?.commit ? commitSinSufijo(config.extra.commit) : null;
  } catch {
    return null;
  }
}

function resolverBase(canal, baseExplicita) {
  if (baseExplicita) return { ref: baseExplicita, origen: '--base' };
  const commitTest = canal === CANAL.test ? commitDelApkTest() : null;
  if (commitTest) return { ref: commitTest, origen: `extra.commit de ${APK_TEST}` };
  return { ref: tagMobileEnMain(), origen: 'último tag mobile-v* en origin/main' };
}

function esNativo(nombre) {
  const dir = path.join('mobile/node_modules', nombre);
  if (!existsSync(dir)) return NATIVO.desconocido;
  return MARCAS_NATIVAS.some((marca) => existsSync(path.join(dir, marca)));
}

const jsonEn = (ref, archivo) => JSON.parse(git('show', `${ref}:${archivo}`));
const jsonActual = (archivo) => JSON.parse(readFileSync(archivo, 'utf8'));

function describir(c) {
  const version = c.desde && c.hasta ? `${c.desde} → ${c.hasta}` : (c.hasta ?? c.desde);
  const duda = c.nativo === NATIVO.desconocido ? '  (no instalado: verificar si era nativo)' : '';
  return `  ${c.cambio.padEnd(8)} ${c.nombre} ${version}${duda}`;
}

function main([canal, flag, baseExplicita]) {
  if (!Object.values(CANAL).includes(canal) || (flag && flag !== '--base')) {
    console.error(`Uso: nativos-vs-base.mjs <${Object.values(CANAL).join('|')}> [--base <ref>]`);
    return 2;
  }
  const base = resolverBase(canal, baseExplicita);
  console.log(`Base: ${base.ref} (${base.origen})\n`);
  const deps = cambiosNativos(
    jsonEn(base.ref, 'mobile/package.json').dependencies,
    jsonActual('mobile/package.json').dependencies,
    esNativo,
  );
  const plugins = cambiosDePlugins(
    jsonEn(base.ref, 'mobile/app.json').expo.plugins,
    jsonActual('mobile/app.json').expo.plugins,
  );
  console.log('Dependencias nativas distintas al APK:');
  console.log(deps.length ? deps.map(describir).join('\n') : '  ninguna');
  console.log(`Config plugins agregados: ${plugins.agregados.join(', ') || 'ninguno'}`);
  console.log(`Config plugins quitados:  ${plugins.quitados.join(', ') || 'ninguno'}`);
  console.log(
    `\nDiff de config contra la base (revisar a mano plugins, android, updates, runtimeVersion):`,
  );
  console.log(git('diff', '--stat', base.ref, '--', ...ARCHIVOS_CONFIG) || '  sin cambios');
  return deps.length || plugins.agregados.length || plugins.quitados.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
