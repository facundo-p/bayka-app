import { computeReversedPositions } from '../../src/utils/reverseOrder';

describe('computeReversedPositions', () => {
  it('reverses 3-tree list correctly', () => {
    const input = [
      { id: 'a', posicion: 1 },
      { id: 'b', posicion: 2 },
      { id: 'c', posicion: 3 },
    ];
    const result = computeReversedPositions(input);
    expect(result).toEqual([
      { id: 'a', newPosicion: 3 },
      { id: 'b', newPosicion: 2 },
      { id: 'c', newPosicion: 1 },
    ]);
  });

  it('handles single-tree list (position unchanged)', () => {
    const input = [{ id: 'a', posicion: 1 }];
    const result = computeReversedPositions(input);
    expect(result).toEqual([{ id: 'a', newPosicion: 1 }]);
  });

  it('handles empty list', () => {
    expect(computeReversedPositions([])).toEqual([]);
  });

  it('formula: newPosicion = total - oldPosicion + 1', () => {
    const input = [
      { id: 'x', posicion: 2 },
      { id: 'y', posicion: 4 },
    ];
    // total = 2; pos 2 → 2-2+1=1; pos 4 → 2-4+1=-1
    // Note: this tests the formula — input positions need not start at 1
    const result = computeReversedPositions(input);
    expect(result.find(r => r.id === 'x')!.newPosicion).toBe(1);
  });
});
