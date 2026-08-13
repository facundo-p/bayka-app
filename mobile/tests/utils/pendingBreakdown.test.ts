import { formatPendingBreakdown } from '../../src/utils/pendingBreakdown';

describe('formatPendingBreakdown', () => {
  test('todo en cero devuelve null', () => {
    expect(formatPendingBreakdown({ grupos: 0, parcelas: 0, fotos: 0 })).toBeNull();
  });

  test('singulares y plurales correctos', () => {
    expect(formatPendingBreakdown({ grupos: 1, parcelas: 2, fotos: 1 }))
      .toBe('1 grupo, 2 parcelas, 1 foto');
  });

  test('omite entidades en cero', () => {
    expect(formatPendingBreakdown({ grupos: 0, parcelas: 0, fotos: 5 })).toBe('5 fotos');
    expect(formatPendingBreakdown({ grupos: 3, parcelas: 0, fotos: 0 })).toBe('3 grupos');
  });
});
