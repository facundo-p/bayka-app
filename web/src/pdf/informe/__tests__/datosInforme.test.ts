import { entradaInforme } from '../../../test/informePdf';
import { datosInforme, notaCoordenadas } from '../datosInforme';

describe('datosInforme', () => {
  test('arma la línea del título con lugar, período, código, organización y estado', () => {
    const modelo = datosInforme(entradaInforme({ parcelas: 2, especies: 2 }));
    expect(modelo.linea).toBe(
      'San Sebastián · Período 2025-2026 · Plantación SS26 · Bayka · Estado: Activa',
    );
  });

  test('sin organización la línea la omite', () => {
    const modelo = datosInforme({
      ...entradaInforme({ parcelas: 1, especies: 1 }),
      organizacion: null,
    });
    expect(modelo.linea).not.toContain('Bayka');
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

  test('GPS, foto y N/N con porcentaje y cantidad', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2, nn: 5 });
    const { gps, foto, pendientes } = datosInforme(entrada).indicadores;
    expect(gps).toEqual({ valor: '17%', detalle: '6 árboles' });
    expect(foto).toEqual({ valor: '50%', detalle: '17 árboles' });
    expect(pendientes).toEqual({ valor: '5', detalle: 'Sin especie identificada', alerta: true });
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

  test('parcelas con grupos, barra, % entero y fila de total', () => {
    const { parcelas } = datosInforme(entradaInforme({ parcelas: 3, especies: 2 }));
    expect(parcelas.filas[0]).toEqual({
      codigo: 'P1',
      nombre: 'Parcela 1',
      grupos: '2',
      arboles: '10',
      fraccion: 1,
      porcentaje: '33%',
    });
    expect(parcelas.total).toEqual({
      titulo: 'Total · 3 parcelas',
      grupos: '6',
      arboles: '30',
      porcentaje: '100%',
    });
  });

  test('los árboles fuera de toda parcela van en «Sin parcela» y el total cierra', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    entrada.dashboard.porParcela[1].cantidad -= 5;
    entrada.dashboard.totalGrupos += 1;
    const { parcelas } = datosInforme(entrada);
    expect(parcelas.filas.at(-1)).toMatchObject({
      codigo: null,
      nombre: 'Sin parcela',
      grupos: '1',
      arboles: '5',
      porcentaje: '17%',
    });
    expect(parcelas.total).toMatchObject({ grupos: '5', arboles: '30', porcentaje: '100%' });
  });

  test('los grupos se cruzan por id de parcela: sin match, «—» en la fila y en el total', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    entrada.dashboard.porParcela[0].codigo = 'OTRO';
    const conIdAjeno = { ...entrada, parcelas: [{ id: 'parc-1', grupos: 4 }] };
    const { parcelas } = datosInforme(conIdAjeno);
    expect(parcelas.filas.map((fila) => fila.grupos)).toEqual(['—', '4']);
    expect(parcelas.total?.grupos).toBe('—');
  });

  test('sin parcelas legibles: Grupos en «—», el resto igual y el mapa con etiquetas', () => {
    const entrada = { ...entradaInforme({ parcelas: 2, especies: 2 }), parcelas: null };
    const modelo = datosInforme(entrada);
    expect(modelo.parcelas.filas.map((fila) => [fila.grupos, fila.arboles])).toEqual([
      ['—', '15'],
      ['—', '15'],
    ]);
    expect(modelo.parcelas.total).toMatchObject({ grupos: '—', arboles: '30' });
    expect(modelo.mapa.etiquetas.map((etiqueta) => etiqueta.texto)).toEqual(['P1', 'P2']);
  });

  test('el mapa pinta cada punto con el color de su especie y deja la leyenda en el mismo orden', () => {
    const { mapa } = datosInforme(entradaInforme({ parcelas: 2, especies: 2, nn: 5 }));
    expect(mapa.leyenda).toEqual([
      { texto: 'LAP', color: '#0a3760' },
      { texto: 'TIM', color: '#99b95b' },
      { texto: 'N/N', color: '#e0a83b' },
    ]);
    expect(mapa.puntos[0].color).toBe('#0a3760');
    expect(mapa.etiquetas.map((etiqueta) => etiqueta.texto)).toEqual(['P1', 'P2']);
    expect(mapa.vacio).toBeNull();
  });

  test('sin árboles: indicadores en 0 y cada bloque dice por qué está vacío', () => {
    const modelo = datosInforme(entradaInforme({ parcelas: 2, especies: 0, objetivo: null }));
    expect(modelo.indicadores.gps.valor).toBe('0%');
    expect(modelo.indicadores.pendientes.alerta).toBe(false);
    expect(modelo.especies).toMatchObject({
      filas: [],
      vacio: 'Todavía no hay árboles registrados.',
    });
    expect(modelo.parcelas).toMatchObject({ filas: [], total: null });
    expect(modelo.mapa).toMatchObject({ vacio: 'Todavía no hay árboles registrados.', nota: null });
  });

  test('sin GPS el mapa explica que no hay puntos', () => {
    const { mapa } = datosInforme(entradaInforme({ parcelas: 2, especies: 2, conGps: false }));
    expect(mapa.vacio).toBe(
      'Ningún árbol tiene coordenadas GPS: no hay puntos para mostrar en el mapa.',
    );
  });

  test('«sin GPS» lo deciden los conteos, aunque la lectura de puntos traiga alguno', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    entrada.dashboard.arbolesConGps = 0;
    expect(datosInforme(entrada).mapa.vacio).toBe(
      'Ningún árbol tiene coordenadas GPS: no hay puntos para mostrar en el mapa.',
    );
  });

  test('con árboles con GPS pero sin puntos leídos, el mapa no está disponible', () => {
    const entrada = { ...entradaInforme({ parcelas: 2, especies: 2 }), puntos: [] };
    expect(datosInforme(entrada).mapa.vacio).toBe('Mapa no disponible.');
  });

  test('descarta los puntos de especies que no están en los conteos', () => {
    const entrada = entradaInforme({ parcelas: 2, especies: 2 });
    const ajeno = { ...entrada.puntos![0], codigo: 'XYZ' };
    const { mapa } = datosInforme({ ...entrada, puntos: [...entrada.puntos!, ajeno] });
    expect(mapa.puntos).toHaveLength(entrada.puntos!.length);
    expect(mapa.leyenda.map((item) => item.texto)).toEqual(['LAP', 'TIM']);
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
  expect(datosInforme(entrada).mapa).toMatchObject({ vacio: 'Mapa no disponible.', puntos: [] });
});
