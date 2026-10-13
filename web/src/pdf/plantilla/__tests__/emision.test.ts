import { emisionDePlantacion } from '../emision';

vi.mock('../recursosNavegador', () => ({ logoNavegador: () => '/logo-bayka.png' }));

const PLANTACION = { lugar: 'San Sebastián', periodo: '2025-2026' };

afterEach(() => vi.useRealTimers());

test('el encabezado con el logo del navegador y la fecha de emisión pedida', () => {
  expect(emisionDePlantacion(PLANTACION, new Date(2026, 9, 6, 12))).toEqual({
    encabezado: { logo: '/logo-bayka.png', titulo: 'San Sebastián · 2025-2026' },
    emitido: '06/10/2026',
  });
});

test('sin fecha, se emite hoy', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 11, 31, 9));
  expect(emisionDePlantacion(PLANTACION).emitido).toBe('31/12/2026');
});
