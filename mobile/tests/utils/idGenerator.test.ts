import { generateSubId } from '../../src/utils/idGenerator';

describe('generateSubId', () => {
  it('generates correct SubID for standard tree', () => {
    expect(generateSubId('LP1', 'L23B', 'ANC', 12)).toBe('LP1L23BANC12');
  });

  it('generates correct SubID for N/N tree', () => {
    expect(generateSubId('LP1', 'L23B', 'NN', 5)).toBe('LP1L23BNN5');
  });

  it('generates correct SubID for short codes', () => {
    expect(generateSubId('MP3', 'L1', 'LAP', 1)).toBe('MP3L1LAP1');
  });

  it('handles position 0', () => {
    expect(generateSubId('LP1', 'L23B', 'ANC', 0)).toBe('LP1L23BANC0');
  });

  it('includes parcela code as prefix', () => {
    expect(generateSubId('SO', 'G1', 'ANC', 3)).toBe('SOG1ANC3');
  });
});
