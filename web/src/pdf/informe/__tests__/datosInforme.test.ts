import { opcionesCon, SIN_OPCIONES } from '../../../lib/opcionesInforme';
import {
  combinacionesDeOpciones,
  entradaInforme,
  nombreCombinacion,
} from '../../../test/informePdf';
import { coloresDeEspecies } from '../../../theme/coloresEspecie';
import { datosInforme, notaCoordenadas, type EntradaInforme } from '../datosInforme';

/** El mapa de un modelo con el mapa elegido. */
function mapaDe(entrada: EntradaInforme) {
  const { mapa } = datosInforme(entrada);
  if (!mapa) throw new Error('El modelo no trae el mapa');
  return mapa;
}

describe('datosInforme', () => {
  test('la línea del título es la del encabezado: lugar y período', () => {
    const modelo = datosInforme(entradaInforme({ parcelas: 2, especies: 2 }));
    expect(modelo.linea).toBe('San Sebastián · 2025-2026');
  });

  test('con meta: total, «de META», barra acotada y el % sin acotar', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 4, objetivo: 80 });
    const { arboles } = datosInforme(entrada).indicadores;
    expect(arboles).toEqual({
      valor: '100',
      meta: 'de 80',
      avance: 1,
      textoAvance: '125% de la meta',
    });
  });

  test('sin meta: solo el total, sin barra', () => {
    const { arboles } = datosInforme(
      entradaInforme({ parcelas: 2, especies: 4, objetivo: null }),
    ).indicadores;
    expect(arboles).toEqual({ valor: '100', meta: null, avance: null, textoAvance: null });
  });

  test('con meta elegida pero sin objetivo, solo el total', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 4, objetivo: null });
    expect(datosInforme(entrada).indicadores.arboles.meta).toBeNull();
  });

  test('sin la casilla de meta, solo el total aunque haya objetivo', () => {
    const entrada = entradaInforme({
      parcelas: 2,
      especies: 4,
      objetivo: 80,
      opciones: SIN_OPCIONES,
    });
    expect(datosInforme(entrada).indicadores.arboles).toEqual({
      valor: '100',
      meta: null,
      avance: null,
      textoAvance: null,
    });
  });

  test('GPS y foto con porcentaje y cantidad, en ese orden; N/N ya no es un indicador', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2, nn: 5 });
    expect(datosInforme(entrada).indicadores.porcentajes).toEqual([
      { rotulo: 'Con GPS', valor: '17%', detalle: '6 árboles' },
      { rotulo: 'Con foto', valor: '50%', detalle: '17 árboles' },
    ]);
  });

  test('especies por cantidad, con color, barra relativa a la mayor y N/N rotulada', () => {
    const { especies } = datosInforme(entradaInforme({ parcelas: 2, especies: 2, nn: 5 }));
    expect(especies.titulo).toBe('Distribución por especie · 2 especies');
    expect(especies.filas).toEqual([
      expect.objectContaining({
        titulo: 'LAP · Especie LAP',
        color: '#0a3760',
        fraccion: 1,
      }),
      expect.objectContaining({ titulo: 'TIM · Especie TIM', fraccion: 0.5, porcentaje: '29%' }),
      expect.objectContaining({ titulo: 'N/N · Sin identificar', color: '#e0a83b' }),
    ]);
  });

  test('por especie y el mapa usan los colores de la plantación, no el orden por cantidad (#845)', () => {
    const colorDe = coloresDeEspecies([
      { codigo: 'LAP', lugarColor: 3 },
      { codigo: 'TIM', lugarColor: 0 },
    ]);
    const entrada = { ...entradaInforme({ parcelas: 1, especies: 2 }), colorDe };
    const modelo = datosInforme(entrada);
    expect(modelo.especies.filas.map((fila) => fila.color)).toEqual(['#6b8f3c', '#0a3760']);
    expect(mapaDe(entrada).puntos.map((punto) => punto.color)).toEqual([
      '#6b8f3c',
      '#0a3760',
      '#6b8f3c',
    ]);
  });

  test('el mapa pinta cada punto con el color de su especie, N/N incluida', () => {
    const mapa = mapaDe(entradaInforme({ parcelas: 2, especies: 2, nn: 5 }));
    expect(mapa.puntos.slice(0, 3).map((punto) => punto.color)).toEqual([
      '#0a3760',
      '#99b95b',
      '#e0a83b',
    ]);
    expect(mapa.vacio).toBeNull();
  });

  test('sin árboles: indicadores en 0 y cada bloque dice por qué está vacío', () => {
    const modelo = datosInforme(entradaInforme({ parcelas: 2, especies: 0, objetivo: null }));
    expect(modelo.indicadores.porcentajes.map((indicador) => indicador.valor)).toEqual([
      '0%',
      '0%',
    ]);
    expect(modelo.especies).toMatchObject({
      filas: [],
      vacio: 'Todavía no hay árboles registrados.',
    });
    expect(modelo.mapa).toMatchObject({ vacio: 'Todavía no hay árboles registrados.', nota: null });
  });

  test('sin GPS el mapa explica que no hay puntos', () => {
    const mapa = mapaDe(entradaInforme({ parcelas: 2, especies: 2, conGps: false }));
    expect(mapa.vacio).toBe(
      'Ningún árbol tiene coordenadas GPS: no hay puntos para mostrar en el mapa.',
    );
  });

  test('«sin GPS» lo deciden los conteos, aunque la lectura de puntos traiga alguno', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    entrada.dashboard.arbolesConGps = 0;
    expect(mapaDe(entrada).vacio).toBe(
      'Ningún árbol tiene coordenadas GPS: no hay puntos para mostrar en el mapa.',
    );
  });

  test('con árboles con GPS pero sin puntos leídos, el mapa no está disponible', () => {
    const entrada = { ...entradaInforme({ parcelas: 2, especies: 2 }), puntos: [] };
    expect(mapaDe(entrada).vacio).toBe('Mapa no disponible.');
  });

  test('descarta los puntos de especies que no están en los conteos', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    const ajeno = { ...entrada.puntos![0], codigo: 'XYZ' };
    const mapa = mapaDe({ ...entrada, puntos: [...entrada.puntos!, ajeno] });
    expect(mapa.puntos).toHaveLength(entrada.puntos!.length);
  });
});

describe('notaCoordenadas', () => {
  test('cuenta los que faltan en el mapa', () => {
    expect(notaCoordenadas(7959, 8467)).toBe(
      '7.959 de 8.467 árboles tienen coordenadas; los 508 restantes no aparecen en el mapa.',
    );
  });

  test('uno solo sin coordenadas, o ninguno', () => {
    expect(notaCoordenadas(9, 10)).toBe(
      '9 de 10 árboles tienen coordenadas; el restante no aparece en el mapa.',
    );
    expect(notaCoordenadas(10, 10)).toBe('10 de 10 árboles tienen coordenadas.');
  });
});

test('si los puntos no se pudieron leer, el mapa no está disponible', () => {
  const entrada = { ...entradaInforme({ parcelas: 2, especies: 2 }), puntos: null };
  expect(mapaDe(entrada)).toMatchObject({ vacio: 'Mapa no disponible.', puntos: [] });
});

describe('las 16 combinaciones de casillas', () => {
  const combinaciones = combinacionesDeOpciones();
  const entrada = (opciones: EntradaInforme['opciones']) =>
    entradaInforme({ parcelas: 3, especies: 3, nn: 2, opciones });

  // Salen de la lista del código bajo prueba: el literal ataja una opción de más o de menos.
  test('son 16, todas distintas', () => {
    expect(combinaciones).toHaveLength(16);
    expect(new Set(combinaciones.map(nombreCombinacion)).size).toBe(16);
  });

  test.each(combinaciones.map((opciones) => [nombreCombinacion(opciones), opciones]))(
    '%s: cada bloque elegido viene completo y ninguno sobra',
    (_, opciones) => {
      const modelo = datosInforme(entrada(opciones));
      const rotulos = modelo.indicadores.porcentajes.map((indicador) => indicador.rotulo);
      expect(rotulos).toEqual([
        ...(opciones.gps ? ['Con GPS'] : []),
        ...(opciones.foto ? ['Con foto'] : []),
      ]);
      expect(modelo.indicadores.porcentajes.every((indicador) => indicador.valor !== '')).toBe(
        true,
      );
      expect(modelo.indicadores.arboles.valor).toBe('62');
      expect(modelo.indicadores.arboles.meta).toBe(opciones.meta ? 'de 8.000' : null);
      expect(modelo.especies.filas).toHaveLength(4);
      expect(modelo.mapa === null).toBe(!opciones.mapa);
      if (modelo.mapa)
        expect(modelo.mapa).toMatchObject({ vacio: null, puntos: expect.any(Array) });
      expect(Object.keys(modelo).sort()).toEqual(['especies', 'indicadores', 'linea', 'mapa']);
    },
  );
});

test('solo el mapa: sin porcentajes ni meta, y con sus puntos', () => {
  const modelo = datosInforme(
    entradaInforme({ parcelas: 2, especies: 2, opciones: opcionesCon(['mapa']) }),
  );
  expect(modelo.indicadores.porcentajes).toEqual([]);
  expect(modelo.indicadores.arboles.meta).toBeNull();
  expect(modelo.mapa?.puntos).toHaveLength(6);
});
