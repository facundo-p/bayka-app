import { buscarCodigoRepetido, buscarDuplicada, mismoLugarYPeriodo } from '../../src/utils/duplicadoDePlantacion';

const plantacion = (id: string, lugar: string, periodo: string, eliminadaEnServidorEn: string | null = null) =>
  ({ id, lugar, periodo, eliminadaEnServidorEn });

describe('aviso de plantación duplicada', () => {
  const locales = [plantacion('a', 'Lote Norte', 'Otoño 2026'), plantacion('b', 'Campo Sur', '2026')];

  it('compara como el ilike de la web: sin espacios de borde ni mayúsculas', () => {
    expect(mismoLugarYPeriodo({ lugar: '  lote NORTE ', periodo: 'otoño 2026' }, locales[0])).toBe(true);
    expect(buscarDuplicada(locales, { lugar: 'LOTE NORTE', periodo: ' Otoño 2026' })?.id).toBe('a');
  });

  it('no avisa si solo coincide uno de los dos', () => {
    expect(buscarDuplicada(locales, { lugar: 'Lote Norte', periodo: '2026' })).toBeNull();
  });

  it('en edición no se compara con ella misma', () => {
    expect(buscarDuplicada(locales, { lugar: 'Lote Norte', periodo: 'Otoño 2026' }, 'a')).toBeNull();
  });

  it('ignora las eliminadas en el servidor y los campos vacíos', () => {
    const conEliminada = [plantacion('c', 'Lote Norte', 'Otoño 2026', '2026-09-01')];
    expect(buscarDuplicada(conEliminada, { lugar: 'Lote Norte', periodo: 'Otoño 2026' })).toBeNull();
    expect(buscarDuplicada([plantacion('d', '', '')], { lugar: ' ', periodo: '' })).toBeNull();
  });
});

describe('código repetido (#559)', () => {
  const conCodigo = (id: string, codigo: string | null, eliminadaEnServidorEn: string | null = null) =>
    ({ id, codigo, eliminadaEnServidorEn });
  const locales = [conCodigo('a', 'LN26'), conCodigo('b', null)];

  it('encuentra otra con el mismo código', () => {
    expect(buscarCodigoRepetido(locales, 'LN26')?.id).toBe('a');
  });

  it('no se compara con la que se edita, ni con vacíos ni eliminadas en el servidor', () => {
    expect(buscarCodigoRepetido(locales, 'LN26', 'a')).toBeNull();
    expect(buscarCodigoRepetido(locales, '')).toBeNull();
    expect(buscarCodigoRepetido([conCodigo('c', 'LN26', '2026-09-01')], 'LN26')).toBeNull();
  });
});
