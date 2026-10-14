// @vitest-environment node
import { Font } from '@react-pdf/renderer';
import { FUENTES_NODE } from '../../../test/pdfNode';
import { registrarFuentes, renderizarEnSerie, renderizarSaneado } from '../fuentes';

test('los documentos se renderizan de a uno, en el orden pedido', async () => {
  const orden: string[] = [];
  const documento = (nombre: string, demora: number) =>
    renderizarEnSerie(FUENTES_NODE, async () => {
      orden.push(`empieza ${nombre}`);
      await new Promise((listo) => setTimeout(listo, demora));
      orden.push(`termina ${nombre}`);
      return nombre;
    });
  await Promise.all([documento('a', 20), documento('b', 0)]);
  expect(orden).toEqual(['empieza a', 'termina a', 'empieza b', 'termina b']);
});

test('un documento que falla no traba los siguientes', async () => {
  const fallido = renderizarEnSerie(FUENTES_NODE, () => Promise.reject(new Error('falló')));
  const siguiente = renderizarEnSerie(FUENTES_NODE, () => Promise.resolve('ok'));
  await expect(fallido).rejects.toThrow('falló');
  await expect(siguiente).resolves.toBe('ok');
});

test('Helvetica, el respaldo de textkit, sigue leída después de descartar las fuentes', () => {
  registrarFuentes(FUENTES_NODE);
  registrarFuentes(FUENTES_NODE);
  expect(Font.getFont({ fontFamily: 'Helvetica', fontWeight: 700 }).data).not.toBeNull();
});

describe('con las fuentes reales, lo que no dibujan todas las pilas se reemplaza', () => {
  const sanear = (texto: string) =>
    renderizarSaneado(FUENTES_NODE, { texto }, async (saneado) => saneado.texto);

  test.each([
    ['Ñandubay ¿á é í ó ú ü? «»·—…', 'Ñandubay ¿á é í ó ú ü? «»·—…'],
    // Poppins no las tiene; Helvetica, sí.
    ['Šiauliai ž ƒ', 'Šiauliai ž ƒ'],
    // Helvetica no la tiene; las fuentes registradas, todas.
    ['ı', 'ı'],
    // Biolinum las tiene, pero Poppins y Helvetica no: quedan sus letras base.
    ['Ñu Guasũ ĩ', 'Ñu Guasu i'],
    ['ẽ ỹ g\u0303', 'e y g'],
    ['Σ', '?'],
    ['中文', '??'],
    ['Yerba 😀', 'Yerba ?'],
  ])('%s → %s', async (texto, saneado) => {
    expect(await sanear(texto)).toBe(saneado);
  });
});
