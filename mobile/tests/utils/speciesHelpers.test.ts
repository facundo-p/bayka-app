import { resolveEspecieCodigo, UNKNOWN_SPECIES_CODE, getSpeciesCode, getSpeciesName } from '../../src/utils/speciesHelpers';

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

function makeQueryable(result: Array<{ codigo: string }>) {
  const where = jest.fn().mockResolvedValue(result);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select, from, where };
}

describe('resolveEspecieCodigo', () => {
  test('returns UNKNOWN_SPECIES_CODE without querying when especieId is null', async () => {
    const queryable = makeQueryable([]);
    const result = await resolveEspecieCodigo(queryable as any, null);
    expect(result).toBe(UNKNOWN_SPECIES_CODE);
    expect(queryable.select).not.toHaveBeenCalled();
  });

  test('returns the species codigo when found', async () => {
    const queryable = makeQueryable([{ codigo: 'ANC' }]);
    const result = await resolveEspecieCodigo(queryable as any, 'esp-1');
    expect(result).toBe('ANC');
  });

  test('returns UNKNOWN_SPECIES_CODE when the species row is missing', async () => {
    const queryable = makeQueryable([]);
    const result = await resolveEspecieCodigo(queryable as any, 'esp-orphan');
    expect(result).toBe(UNKNOWN_SPECIES_CODE);
  });
});
