import {
  estimarReporte,
  FILAS_POR_HOJA,
  MODO_REPORTE,
  paginarReporte,
  repartirArboles,
  TARJETAS_POR_HOJA,
  TOPE_TARJETAS,
  type EstimacionReporte,
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

  /** Cada número es el alto de su tarjeta o de su fila. */
  const SU_ALTO = { tarjeta: (alto: number) => alto, fila: (alto: number) => alto };

  // 437,28 pt debajo del encabezado de columnas, con 2 de colchón.
  test('el listado llena cada hoja por alto: una fila que justo entra, entra', () => {
    const hojas = paginarReporte({ tarjetas: [], listado: [100, 200, 137.28, 1] }, SU_ALTO);
    expect(hojas).toEqual([
      { tipo: 'listado', filas: [100, 200, 137.28] },
      { tipo: 'listado', filas: [1] },
    ]);
  });

  test('una fila más alta que la hoja va sola en la suya', () => {
    const hojas = paginarReporte({ tarjetas: [], listado: [10, 500, 10] }, SU_ALTO);
    expect(hojas.map((hoja) => hoja.tipo === 'listado' && hoja.filas)).toEqual([[10], [500], [10]]);
  });

  // 455,28 pt de cuerpo, con 2 de colchón, y 10 entre filas de tarjetas.
  test('cada fila de tarjetas mide lo que la más alta, con la separación entre filas', () => {
    const hojas = paginarReporte({ tarjetas: [200, 100, 50, 245.28, 1], listado: [] }, SU_ALTO);
    expect(hojas).toEqual([
      { tipo: 'tarjetas', tarjetas: [200, 100, 50, 245.28] },
      { tipo: 'tarjetas', tarjetas: [1] },
    ]);
  });
});

describe('estimarReporte', () => {
  test('es un piso: con filas de más de un renglón, el plan da más hojas', () => {
    const listado = rango(0, FILAS_POR_HOJA + 1);
    const estimado = estimarReporte({
      total: listado.length,
      conFoto: 0,
      modo: MODO_REPORTE.sinFotos,
    });
    const deDosRenglones = { tarjeta: () => 0, fila: () => 2 * 14 };
    expect(estimado.hojas).toBe(2);
    expect(paginarReporte({ tarjetas: [], listado }, deDosRenglones)).toHaveLength(3);
  });

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

  /** Lo que da el plan con los árboles en la mano. */
  function delPlan(arboles: ReturnType<typeof arbolesDe>, modo: ModoReporte) {
    const reparto = repartirArboles(arboles, modo);
    return {
      tarjetas: reparto.tarjetas.length,
      filasListado: reparto.listado.length,
      hojas: paginarReporte(reparto).length,
    };
  }

  const MODOS = Object.values(MODO_REPORTE) as ModoReporte[];

  const sonIguales = (estimado: EstimacionReporte, plan: EstimacionReporte) =>
    (['tarjetas', 'filasListado', 'hojas'] as const).every(
      (campo) => estimado[campo] === plan[campo],
    );

  /** Cada corte de `paso` (uno antes, justo y uno después) hasta `hasta`, más 0 y 1. */
  function cortes(paso: number, hasta: number, desde = 0): number[] {
    const multiplos = rango(0, Math.floor((hasta - desde) / paso) + 1).map((k) => desde + k * paso);
    const valores = [0, 1, ...multiplos.flatMap((m) => [m - 1, m, m + 1])];
    return [...new Set(valores)].filter((valor) => valor >= 0 && valor <= hasta);
  }

  // Ralo a propósito: el plan solo cambia en los cortes de hoja y en el tope.
  // Las fotos de más del tope van al listado, así que también se cruzan esos cortes.
  const CON_FOTO = [
    ...cortes(TARJETAS_POR_HOJA, TOPE_TARJETAS + TARJETAS_POR_HOJA),
    ...cortes(FILAS_POR_HOJA, TOPE_TARJETAS + 2 * FILAS_POR_HOJA, TOPE_TARJETAS),
  ];
  const SIN_FOTO = cortes(FILAS_POR_HOJA, 3 * FILAS_POR_HOJA);

  test('da lo mismo que el plan en cada corte de hoja y alrededor del tope', () => {
    const distintos = [];
    for (const cantidadConFoto of CON_FOTO) {
      for (const cantidadSinFoto of SIN_FOTO) {
        const total = cantidadConFoto + cantidadSinFoto;
        const arboles = arbolesDe(total, cantidadConFoto);
        for (const modo of MODOS) {
          const conteo = { total, conFoto: cantidadConFoto, modo };
          const [estimado, plan] = [estimarReporte(conteo), delPlan(arboles, modo)];
          if (!sonIguales(estimado, plan)) distintos.push({ conteo, estimado, plan });
        }
      }
    }
    // Una sola aserción: con una por caso, miles de expect tardan más que las cuentas.
    expect(distintos).toEqual([]);
  });

  test.each([
    [7000, 0],
    [7000, 1500],
  ])('con %i árboles y %i con foto da lo mismo que el plan', (total, cantidadConFoto) => {
    const arboles = arbolesDe(total, cantidadConFoto);
    for (const modo of MODOS) {
      expect(estimarReporte({ total, conFoto: cantidadConFoto, modo })).toEqual(
        delPlan(arboles, modo),
      );
    }
  });

  test('un conteo con foto mayor que el total se acota al total', () => {
    expect(estimarReporte({ total: 5, conFoto: 8, modo: MODO_REPORTE.conFotos })).toEqual({
      tarjetas: 5,
      filasListado: 0,
      hojas: 1,
    });
  });
});
