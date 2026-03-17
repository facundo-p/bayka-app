// Tests for TreeRepository — implemented in Plan 02-02
// Covers: TREE-02, TREE-03, TREE-07, NN-04, REVR-01, REVR-02

describe('TreeRepository', () => {
  describe('insertTree', () => {
    it.todo('inserts tree with auto-incremented position (TREE-02, TREE-03)');
    it.todo('first tree in subgroup gets posicion=1 (TREE-03)');
    it.todo('generates correct subId (TREE-04)');
    it.todo('stores null especieId for N/N trees (NN-01)');
  });

  describe('deleteLastTree', () => {
    it.todo('deletes only the last tree by posicion (TREE-07)');
    it.todo('does nothing if subgroup has no trees');
  });

  describe('reverseTreeOrder', () => {
    it.todo('updates all posicion values using formula total-N+1 (REVR-01, REVR-02)');
    it.todo('recalculates subId for each tree after reversal (REVR-02)');
    it.todo('runs in a transaction (all updates or none)');
  });

  describe('resolveNNTree', () => {
    it.todo('sets especieId and recalculates subId (NN-04)');
  });
});
