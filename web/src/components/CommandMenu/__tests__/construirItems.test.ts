import type { ResultadoBusqueda } from '../../../queries/buscarQueries';
import type { AccionRapida } from '../accionesRapidas';
import { construirItems, destinoDeItem } from '../construirItems';

const ACCION: AccionRapida = {
  id: 'ir-plantaciones',
  titulo: 'Ir a Plantaciones',
  Icono: (() => null) as unknown as AccionRapida['Icono'],
  to: '/plantaciones',
};

function resultado(parcial: Partial<ResultadoBusqueda> & { id: string }): ResultadoBusqueda {
  return { tipo: 'plantacion', titulo: parcial.id, to: `/x/${parcial.id}`, ...parcial };
}

test('sin texto: arma una única sección de recientes con sus índices', () => {
  const recientes = [resultado({ id: 'r1' }), resultado({ id: 'r2' })];
  const { secciones, itemsPlanos } = construirItems({
    acciones: [ACCION],
    resultados: [resultado({ id: 'no-deberia-aparecer' })],
    recientes,
    hayTexto: false,
  });

  expect(secciones).toHaveLength(1);
  expect(secciones[0]).toMatchObject({ clave: 'recientes', titulo: 'Recientes' });
  expect(secciones[0].items.map((entrada) => entrada.indice)).toEqual([0, 1]);
  expect(itemsPlanos).toEqual([
    { clase: 'resultado', resultado: recientes[0] },
    { clase: 'resultado', resultado: recientes[1] },
  ]);
});

test('sin texto y sin recientes: no arma ninguna sección', () => {
  const { secciones, itemsPlanos } = construirItems({
    acciones: [ACCION],
    resultados: [],
    recientes: [],
    hayTexto: false,
  });
  expect(secciones).toEqual([]);
  expect(itemsPlanos).toEqual([]);
});

test('con texto: sección de acciones primero, luego resultados agrupados por tipo en el orden fijo', () => {
  const plantacion = resultado({ id: 'p1', tipo: 'plantacion' });
  const especie = resultado({ id: 'e1', tipo: 'especie' });
  const arbol = resultado({ id: 'a1', tipo: 'arbol' });
  const { secciones, itemsPlanos } = construirItems({
    acciones: [ACCION],
    // Orden de entrada deliberadamente distinto al orden esperado de salida.
    resultados: [especie, arbol, plantacion],
    recientes: [],
    hayTexto: true,
  });

  expect(secciones.map((seccion) => seccion.clave)).toEqual([
    'acciones',
    'plantacion',
    'arbol',
    'especie',
  ]);
  expect(itemsPlanos).toEqual([
    { clase: 'accion', accion: ACCION },
    { clase: 'resultado', resultado: plantacion },
    { clase: 'resultado', resultado: arbol },
    { clase: 'resultado', resultado: especie },
  ]);
});

test('con texto: los índices son continuos a través de todas las secciones', () => {
  const { secciones } = construirItems({
    acciones: [ACCION],
    resultados: [resultado({ id: 'p1', tipo: 'plantacion' }), resultado({ id: 'p2', tipo: 'plantacion' })],
    recientes: [],
    hayTexto: true,
  });
  const todosLosIndices = secciones.flatMap((seccion) => seccion.items.map((entrada) => entrada.indice));
  expect(todosLosIndices).toEqual([0, 1, 2]);
});

test('con texto: un tipo sin resultados no genera su sección', () => {
  const { secciones } = construirItems({
    acciones: [],
    resultados: [resultado({ id: 'p1', tipo: 'plantacion' })],
    recientes: [],
    hayTexto: true,
  });
  expect(secciones.map((seccion) => seccion.clave)).toEqual(['plantacion']);
});

test('con texto y sin acciones: no arma la sección de acciones', () => {
  const { secciones } = construirItems({
    acciones: [],
    resultados: [],
    recientes: [],
    hayTexto: true,
  });
  expect(secciones).toEqual([]);
});

test('destinoDeItem devuelve el `to` de la acción o del resultado según la clase', () => {
  const item1 = { clase: 'accion', accion: ACCION } as const;
  const item2 = { clase: 'resultado', resultado: resultado({ id: 'p1' }) } as const;
  expect(destinoDeItem(item1)).toBe('/plantaciones');
  expect(destinoDeItem(item2)).toBe('/x/p1');
});
