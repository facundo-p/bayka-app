#!/usr/bin/env node
/**
 * ¿El JS del working tree necesita nativo que el APK del canal no tiene? (#678)
 *
 * Uso, desde la raíz del repo:
 *   node .claude/skills/push-update-apk/scripts/nativos-vs-base.mjs <test|production> [--base <ref>]
 *
 * Sale con 1 si hay módulos nativos o config plugins distintos al APK (el OTA no alcanza:
 * APK nuevo), con 0 si no, y con 2 si el uso es inválido o la config no se pudo evaluar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pluginsEfectivos } from './lib/configEfectiva.mjs';
import {
  cambiosDePlugins,
  cambiosNativos,
  commitSinSufijo,
  instalacionesDesactualizadas,
  MARCAS_NATIVAS,
  NATIVO,
} from './lib/nativos.mjs';

const { CANAL_OTA } = createRequire(import.meta.url)('../../../../scripts/variantesMobile.cjs');
const SALIDA = Object.freeze({ sinNativos: 0, conNativos: 1, error: 2 });
const APK_TEST = 'mobile/build-output-test.apk';
const NODE_MODULES = 'mobile/node_modules';
const ARCHIVOS_CONFIG = ['mobile/app.json', 'mobile/app.config.js'];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const jsonEn = (ref, archivo) => JSON.parse(git('show', `${ref}:${archivo}`));

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
  const commitTest = canal === CANAL_OTA.test ? commitDelApkTest() : null;
  if (commitTest) return { ref: commitTest, origen: `extra.commit de ${APK_TEST}` };
  return { ref: tagMobileEnMain(), origen: 'último tag mobile-v* en origin/main' };
}

function esNativo(nombre) {
  const dir = path.join(NODE_MODULES, nombre);
  if (!existsSync(dir)) return NATIVO.desconocido;
  return MARCAS_NATIVAS.some((marca) => existsSync(path.join(dir, marca)));
}

function versionInstalada(nombre) {
  const manifiesto = path.join(NODE_MODULES, nombre, 'package.json');
  return existsSync(manifiesto) ? leerJson(manifiesto).version : null;
}

/** Aviso si node_modules no es lo que instala el lockfile: esNativo lo usa de fuente. */
function avisarInstalacionVieja(dependencias) {
  if (!existsSync('mobile/package-lock.json')) return;
  const { packages } = leerJson('mobile/package-lock.json');
  const viejas = instalacionesDesactualizadas(
    Object.keys(dependencias),
    (nombre) => packages[`node_modules/${nombre}`]?.version,
    versionInstalada,
  );
  if (!viejas.length) return;
  console.log('AVISO: mobile/node_modules no coincide con el lockfile (correr `npm install`):');
  for (const p of viejas)
    console.log(`  ${p.nombre}: lock ${p.esperada}, instalada ${p.instalada ?? '—'}`);
  console.log('La clasificación nativo/JS de esos paquetes puede estar mal.\n');
}

function describir(c) {
  const version = c.desde && c.hasta ? `${c.desde} → ${c.hasta}` : (c.hasta ?? c.desde);
  const duda = c.nativo === NATIVO.desconocido ? '  (no instalado: verificar si era nativo)' : '';
  return `  ${c.cambio.padEnd(8)} ${c.nombre} ${version}${duda}`;
}

function informar(deps, plugins, base) {
  console.log('Dependencias nativas distintas al APK:');
  console.log(deps.length ? deps.map(describir).join('\n') : '  ninguna');
  console.log(`Config plugins agregados: ${plugins.agregados.join(', ') || 'ninguno'}`);
  console.log(`Config plugins quitados:  ${plugins.quitados.join(', ') || 'ninguno'}`);
  console.log(
    `\nDiff de config contra la base (revisar plugins, android, updates, runtimeVersion):`,
  );
  console.log(git('diff', base, '--', ...ARCHIVOS_CONFIG) || '  sin cambios');
}

function comparar(canal, base) {
  const actuales = leerJson('mobile/package.json').dependencies;
  avisarInstalacionVieja(actuales);
  const deps = cambiosNativos(jsonEn(base, 'mobile/package.json').dependencies, actuales, esNativo);
  const plugins = cambiosDePlugins(pluginsEfectivos(canal, base), pluginsEfectivos(canal));
  informar(deps, plugins, base);
  const hayNativos = deps.length || plugins.agregados.length || plugins.quitados.length;
  return hayNativos ? SALIDA.conNativos : SALIDA.sinNativos;
}

function main([canal, flag, baseExplicita]) {
  if (!Object.values(CANAL_OTA).includes(canal) || (flag && flag !== '--base')) {
    console.error(
      `Uso: nativos-vs-base.mjs <${Object.values(CANAL_OTA).join('|')}> [--base <ref>]`,
    );
    return SALIDA.error;
  }
  const base = resolverBase(canal, baseExplicita);
  console.log(`Base: ${base.ref} (${base.origen}) · canal ${canal}\n`);
  try {
    return comparar(canal, base.ref);
  } catch (error) {
    console.error(`No se pudo comparar contra la base: ${error.message}`);
    return SALIDA.error;
  }
}

process.exitCode = main(process.argv.slice(2));
