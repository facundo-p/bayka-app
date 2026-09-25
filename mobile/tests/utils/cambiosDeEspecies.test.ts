import { cambiosDeLaSeleccion, especiesConArbolesDe, mensajeEspeciesConArboles } from '../../src/utils/cambiosDeEspecies';

describe('cambiosDeLaSeleccion', () => {
  const iniciales = [
    { especieId: 'a', enabled: true },
    { especieId: 'b', enabled: false },
    { especieId: 'c', enabled: true },
  ];

  it('solo lo que cambió', () => {
    const actuales = [
      { especieId: 'a', enabled: false },
      { especieId: 'b', enabled: true },
      { especieId: 'c', enabled: true },
    ];
    expect(cambiosDeLaSeleccion(iniciales, actuales)).toEqual({ altas: ['b'], bajas: ['a'] });
  });

  it('una especie que no estaba al abrir no cuenta', () => {
    expect(cambiosDeLaSeleccion(iniciales, [...iniciales, { especieId: 'z', enabled: true }]))
      .toEqual({ altas: [], bajas: [] });
  });
});

describe('avisos de especies con árboles', () => {
  it('singular y plural', () => {
    expect(mensajeEspeciesConArboles(['Pino'])).toBe('Pino ya tiene árboles registrados en el servidor, así que sigue habilitada.');
    expect(mensajeEspeciesConArboles(['Pino', 'Roble']))
      .toBe('Pino, Roble ya tienen árboles registrados en el servidor, así que siguen habilitadas.');
  });

  it('una línea por plantación del sync con especies re-habilitadas', () => {
    expect(especiesConArbolesDe([
      { success: true, nombre: 'Norte', especiesConArboles: ['Pino', 'Roble'] },
      { success: true, nombre: 'Sur', duplicada: true } as any,
      { success: false, nombre: 'Este' },
    ])).toEqual(['Norte: Pino, Roble']);
  });
});
