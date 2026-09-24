import { conservarEspeciesRecuperadas, especieCodigoParaSubId, UNKNOWN_SPECIES_CODE, getSpeciesCode, getSpeciesName } from '../../src/utils/speciesHelpers';

describe('getSpeciesCode', () => {
  test('returns N/N when especieId is null', () => {
    expect(getSpeciesCode({ especieId: null, especieCodigo: 'ANC' })).toBe('N/N');
  });

  test('returns the especieCodigo when especieId is set', () => {
    expect(getSpeciesCode({ especieId: 'esp-1', especieCodigo: 'ANC' })).toBe('ANC');
  });

  test('falls back to ?? when especieId is set but codigo is missing', () => {
    expect(getSpeciesCode({ especieId: 'esp-1', especieCodigo: null })).toBe('??');
  });

  test('una especie recuperada se muestra como ??, no con su codigo provisorio', () => {
    expect(getSpeciesCode({ especieId: 'esp-1', especieCodigo: 'recuperada:esp-1' })).toBe('??');
  });
});

describe('getSpeciesName', () => {
  test('returns N/N when especieId is null', () => {
    expect(getSpeciesName({ especieId: null, especieNombre: 'Anco' })).toBe('N/N');
  });

  test('returns the especieNombre when especieId is set', () => {
    expect(getSpeciesName({ especieId: 'esp-1', especieNombre: 'Anco' })).toBe('Anco');
  });

  test('falls back to ?? when especieId is set but nombre is missing', () => {
    expect(getSpeciesName({ especieId: 'esp-1', especieNombre: null })).toBe('??');
  });
});

const arbol = (especieId: string | null, especieCodigo: string | null, subId = 'P1L1ANC12') =>
  ({ especieId, especieCodigo, subId, posicion: 12 });

describe('especieCodigoParaSubId', () => {
  test('N/N va como NN', () => {
    expect(especieCodigoParaSubId(arbol(null, null), ['P1L1'])).toBe(UNKNOWN_SPECIES_CODE);
  });

  test('usa el codigo de la especie', () => {
    expect(especieCodigoParaSubId(arbol('esp-1', 'ANC'), ['P1L1'])).toBe('ANC');
  });

  test('una especie que no está en la base va como NN', () => {
    expect(especieCodigoParaSubId(arbol('esp-orphan', null), ['P1L1'])).toBe(UNKNOWN_SPECIES_CODE);
  });

  test('una especie recuperada conserva el codigo que ya tenía el SubID', () => {
    expect(especieCodigoParaSubId(arbol('esp-1', 'recuperada:esp-1'), ['P1L1'])).toBe('ANC');
  });

  test('una especie recuperada va como NN si el SubID no calza con el prefijo', () => {
    expect(especieCodigoParaSubId(arbol('esp-1', 'recuperada:esp-1', 'X9ANC12'), ['P1L1'])).toBe('NN');
  });

  test('con varios prefijos lee el codigo del que calza', () => {
    expect(especieCodigoParaSubId(arbol('esp-1', 'recuperada:esp-1', 'P9L1ANC12'), ['P1L1', 'P9L1'])).toBe('ANC');
    expect(especieCodigoParaSubId(arbol('esp-1', 'recuperada:esp-1', 'X9ANC12'), ['P1L1', 'P9L1'])).toBe('NN');
  });

  // Parcela A → A1 con grupo 1: el prefijo anterior `A1` también calza con `A11KOK2` y leería `1KOK`.
  test('si un prefijo extiende a otro, gana el más largo', () => {
    const conPosicion2 = { especieId: 'esp-1', especieCodigo: 'recuperada:esp-1', subId: 'A11KOK2', posicion: 2 };
    expect(especieCodigoParaSubId(conPosicion2, ['A1', 'A11'])).toBe('KOK');
    expect(especieCodigoParaSubId({ ...conPosicion2, subId: 'A1KOK2' }, ['A1', 'A11'])).toBe('KOK');
  });
});

describe('conservarEspeciesRecuperadas', () => {
  test('agrega al final las recuperadas de la plantación que no se eligieron', () => {
    const actuales = [
      { especieId: 'kok', codigo: 'recuperada:kok', ordenVisual: 0 },
      { especieId: 'pin', codigo: 'PIN', ordenVisual: 1 },
    ];
    expect(conservarEspeciesRecuperadas([{ especieId: 'euc', ordenVisual: 0 }], actuales)).toEqual([
      { especieId: 'euc', ordenVisual: 0 },
      { especieId: 'kok', ordenVisual: 1 },
    ]);
  });

  test('sin elegidas, la recuperada queda sola', () => {
    const actuales = [{ especieId: 'kok', codigo: 'recuperada:kok', ordenVisual: 3 }];
    expect(conservarEspeciesRecuperadas([], actuales)).toEqual([{ especieId: 'kok', ordenVisual: 0 }]);
  });
});
