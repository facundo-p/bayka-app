// @vitest-environment node
import { FUENTES_NODE } from '../../../test/pdfNode';
import { renderizarEnSerie } from '../fuentes';

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
