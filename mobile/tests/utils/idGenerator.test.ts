import { generateSubId } from '../../src/utils/idGenerator';

describe('generateSubId', () => {
  it('generates correct SubID for standard tree', () => {
    expect(generateSubId('L23B', 'ANC', 12)).toBe('L23BANC12');
  });

  it('generates correct SubID for N/N tree', () => {
    expect(generateSubId('L23B', 'NN', 5)).toBe('L23BNN5');
  });

  it('generates correct SubID for short codes', () => {
    expect(generateSubId('PA', 'LAP', 1)).toBe('PALAP1');
  });

  it('handles position 0', () => {
    expect(generateSubId('L23B', 'ANC', 0)).toBe('L23BANC0');
  });
});
