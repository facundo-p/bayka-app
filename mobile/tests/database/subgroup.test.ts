// Tests for SubGroupRepository — implemented in Plan 02-02
// Covers: SUBG-01, SUBG-02, SUBG-03, SUBG-05, SUBG-07

describe('SubGroupRepository', () => {
  describe('createSubGroup', () => {
    it.todo('inserts subgroup with correct fields (SUBG-01)');
    it.todo('rejects duplicate codigo within same plantation (SUBG-02)');
    it.todo('allows same codigo in different plantation');
  });

  describe('getLastSubGroupName', () => {
    it.todo('returns nombre of most recently created subgroup (SUBG-03)');
    it.todo('returns null when no subgroups exist');
  });

  describe('finalizeSubGroup', () => {
    it.todo('sets estado to finalizada (SUBG-05)');
    it.todo('blocks finalization when unresolved N/N trees exist (SUBG-05)');
  });

  describe('ownership', () => {
    it.todo('only creator can edit (SUBG-07)');
  });
});
