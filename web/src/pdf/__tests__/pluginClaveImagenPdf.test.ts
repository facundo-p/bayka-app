// @vitest-environment node
// Corre el código instalado de react-pdf en un contexto sin `Buffer`, como el del navegador.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { protegerClaveDeImagen } from '../../../pluginClaveImagenPdf';

const LAYOUT = readFileSync(createRequire(import.meta.url).resolve('@react-pdf/layout'), 'utf8');
const LOGO = 'https://bayka.test/logo-bayka.png';

type NodoImagen = { props: { src: string }; image?: { key?: string } };
type FetchImage = (nodo: NodoImagen) => Promise<void>;

/** `fetchImage` de react-pdf, con los ayudantes que lo preceden. */
function fetchImageSinBuffer(codigo: string, avisos: string[]): FetchImage {
  const desde = codigo.indexOf('const getSource = ');
  const hasta = codigo.indexOf('\n};\n', codigo.indexOf('const fetchImage = '));
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
  const parcheado = protegerClaveDeImagen(LAYOUT) ?? '';
  expect(parcheado).toContain("typeof Buffer !== 'undefined'");
  expect(await claveDelLogo(parcheado)).toBe(LOGO);
});

test('el código que no llama a Buffer.isBuffer queda como está', () => {
  expect(protegerClaveDeImagen('const a = 1;')).toBeNull();
});
