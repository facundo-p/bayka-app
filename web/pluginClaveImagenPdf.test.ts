// @vitest-environment node
// Corre el código instalado de react-pdf en un contexto sin `Buffer`, como el del navegador.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import type { PluginOption } from 'vite';
import { expect, test } from 'vitest';
import { protegerClaveDeImagen } from './pluginClaveImagenPdf';
import configDemo from './vite.demo.config';
import config from './vite.config';

const LAYOUT = readFileSync(createRequire(import.meta.url).resolve('@react-pdf/layout'), 'utf8');
const LOGO = 'https://bayka.test/logo-bayka.png';
const ERROR_CORTES = 'react-pdf cambió fetchImage: revisá el parche (#875)';
const PLUGIN = 'clave-imagen-pdf';

type NodoImagen = { props: { src: string }; image?: { key?: string } };
type FetchImage = (nodo: NodoImagen) => Promise<void>;

/** `fetchImage` de react-pdf, con los ayudantes que lo preceden. */
function fetchImageSinBuffer(codigo: string, avisos: string[]): FetchImage {
  const desde = codigo.indexOf('const getSource = ');
  const inicio = codigo.indexOf('const fetchImage = ');
  const hasta = codigo.indexOf('\n};\n', inicio);
  if ([desde, inicio, hasta].includes(-1)) throw new Error(ERROR_CORTES);
  const contexto = {
    Blob,
    console: { warn: (aviso: string) => avisos.push(aviso) },
    resolveImage: async () => ({}),
  };
  return runInNewContext(`${codigo.slice(desde, hasta)}\n};\nfetchImage`, contexto);
}

async function claveDelLogo(codigo: string, avisos: string[] = []) {
  const nodo: NodoImagen = { props: { src: LOGO } };
  await fetchImageSinBuffer(codigo, avisos)(nodo);
  return nodo.image?.key;
}

// Si una versión nueva de react-pdf lo corrige, este test falla y el parche sobra.
test('sin el parche, react-pdf pierde la clave del logo y lo embebe en cada hoja', async () => {
  const avisos: string[] = [];
  expect(await claveDelLogo(LAYOUT, avisos)).toBeUndefined();
  expect(avisos).toEqual(['Buffer is not defined']);
});

test('con el parche, el logo conserva su clave y se embebe una sola vez', async () => {
  const parcheado = protegerClaveDeImagen(LAYOUT);
  expect(parcheado).not.toBeNull();
  expect(await claveDelLogo(parcheado ?? '')).toBe(LOGO);
});

test('el código ya parcheado no se envuelve de nuevo', () => {
  const parcheado = protegerClaveDeImagen(LAYOUT) ?? '';
  expect(protegerClaveDeImagen(parcheado)).toBe(parcheado);
});

test('el código que no llama a Buffer.isBuffer queda como está', () => {
  expect(protegerClaveDeImagen('const a = 1;')).toBeNull();
});

/** plugin-react devuelve varios plugins: la lista viene anidada. */
function nombres(plugins: PluginOption[] = []): unknown[] {
  return (plugins as unknown[]).flat(Infinity).map((plugin) => (plugin as { name?: string })?.name);
}

test('el plugin está en el build, en el worker del reporte y en la demo', () => {
  expect(nombres(config.plugins)).toContain(PLUGIN);
  expect(nombres(config.worker?.plugins?.())).toContain(PLUGIN);
  expect(nombres(configDemo.plugins)).toContain(PLUGIN);
  expect(nombres(configDemo.worker?.plugins?.())).toContain(PLUGIN);
});
