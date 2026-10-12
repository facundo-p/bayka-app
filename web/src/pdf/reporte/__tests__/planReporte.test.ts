import {
  enTramos,
  estimarReporte,
  FILAS_POR_HOJA,
  MODO_REPORTE,
  paginarReporte,
  repartirArboles,
  TARJETAS_POR_HOJA,
  TOPE_TARJETAS,
  type ModoReporte,
} from '../planReporte';

type Arbol = { id: number; fotoUrl: string | null };

const conFoto = (id: number): Arbol => ({ id, fotoUrl: `p/${id}.jpg` });
const sinFoto = (id: number): Arbol => ({ id, fotoUrl: null });
const ids = (arboles: Arbol[]) => arboles.map((arbol) => arbol.id);
const rango = (desde: number, cantidad: number) =>
  Array.from({ length: cantidad }, (_, indice) => desde + indice);

test('entran 6 tarjetas y 31 filas por hoja horizontal', () => {
  expect(TARJETAS_POR_HOJA).toBe(6);
  expect(FILAS_POR_HOJA).toBe(31);
  expect(TOPE_TARJETAS).toBe(400);
});

describe('repartirArboles', () => {
  test('con fotos, solo las subidas van como tarjeta; cada bloque en el orden de entrada', () => {
    const arboles = [conFoto(1), sinFoto(2), { id: 3, fotoUrl: 'file:///local.jpg' }, conFoto(4)];
    const { tarjetas, listado } = repartirArboles(arboles, MODO_REPORTE.conFotos);
    expect(ids(tarjetas)).toEqual([1, 4]);
    expect(ids(listado)).toEqual([2, 3]);
  });

  test('con 450 árboles con foto, 400 tarjetas y los 50 siguientes al listado', () => {
    const arboles = rango(1, 450).map(conFoto);
    const { tarjetas, listado } = repartirArboles(arboles, MODO_REPORTE.conFotos);
    expect(ids(tarjetas)).toEqual(rango(1, 400));
    expect(ids(listado)).toEqual(rango(401, 50));
  });

  test('los que pasan el tope se intercalan en el listado según el orden del filtro', () => {
    const arboles = [...rango(1, TOPE_TARJETAS).map(conFoto), sinFoto(1001), conFoto(1002)];
    arboles.splice(10, 0, sinFoto(1000));
    const { listado } = repartirArboles(arboles, MODO_REPORTE.conFotos);
    expect(ids(listado)).toEqual([1000, 1001, 1002]);
  });

  test('sin fotos, todo va al listado', () => {
    const arboles = [conFoto(1), sinFoto(2), conFoto(3)];
    const { tarjetas, listado } = repartirArboles(arboles, MODO_REPORTE.sinFotos);
    expect(tarjetas).toEqual([]);
    expect(ids(listado)).toEqual([1, 2, 3]);
  });
});

test('enTramos corta de a N y deja el resto en el último', () => {
  expect(enTramos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(enTramos([], 2)).toEqual([]);
});

describe('paginarReporte', () => {
  test('primero las hojas de tarjetas y después las del listado, que arranca en hoja propia', () => {
    const hojas = paginarReporte({ tarjetas: rango(1, 7), listado: rango(100, 40) });
    expect(hojas).toEqual([
      { tipo: 'tarjetas', tarjetas: rango(1, 6) },
      { tipo: 'tarjetas', tarjetas: [7] },
      { tipo: 'listado', filas: rango(100, 31) },
      { tipo: 'listado', filas: rango(131, 9) },
    ]);
  });

  test('sin árboles no hay hojas', () => {
    expect(paginarReporte({ tarjetas: [], listado: [] })).toEqual([]);
  });
});

describe('estimarReporte', () => {
  test('7.000 árboles sin foto van al listado en 226 hojas', () => {
    expect(estimarReporte({ total: 7000, conFoto: 0, modo: MODO_REPORTE.conFotos })).toEqual({
      tarjetas: 0,
      filasListado: 7000,
      hojas: 226,
    });
  });

  test('450 con foto: 400 tarjetas en 67 hojas y 50 filas en 2', () => {
    expect(estimarReporte({ total: 450, conFoto: 450, modo: MODO_REPORTE.conFotos })).toEqual({
      tarjetas: 400,
      filasListado: 50,
      hojas: 69,
    });
  });

  /** `total` árboles, los primeros `conFoto` con foto subida. */
  const arbolesDe = (total: number, cantidadConFoto: number) =>
    rango(0, total).map((id) => (id < cantidadConFoto ? conFoto(id) : sinFoto(id)));

  test.each([
    [0, 0],
    [1, 0],
    [1, 1],
    [6, 6],
    [7, 7],
    [47, 7],
    [31, 0],
    [32, 0],
    [400, 400],
    [401, 401],
    [450, 450],
    [1000, 420],
    [7000, 0],
    [7000, 1500],
  ])('con %i árboles y %i con foto da lo mismo que el plan', (total, cantidadConFoto) => {
    const arboles = arbolesDe(total, cantidadConFoto);
    for (const modo of Object.values(MODO_REPORTE) as ModoReporte[]) {
      const reparto = repartirArboles(arboles, modo);
      expect(estimarReporte({ total, conFoto: cantidadConFoto, modo })).toEqual({
        tarjetas: reparto.tarjetas.length,
        filasListado: reparto.listado.length,
        hojas: paginarReporte(reparto).length,
      });
    }
  });
});
