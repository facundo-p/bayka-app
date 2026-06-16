// Validación del campo de frecuencia GPS del form de plantación (issue #100).

import { validateGpsFrequency } from '../../src/components/PlantationFormModal';

describe('validateGpsFrequency', () => {
  it('acepta enteros ≥ 1', () => {
    expect(validateGpsFrequency('1')).toBeNull();
    expect(validateGpsFrequency('10')).toBeNull();
    expect(validateGpsFrequency(' 25 ')).toBeNull();
  });

  it('rechaza 0, negativos, decimales, vacío y texto', () => {
    for (const invalid of ['0', '-3', '2.5', '', '  ', 'abc', '10a']) {
      expect(validateGpsFrequency(invalid)).not.toBeNull();
    }
  });
});
