describe('Migration infrastructure', () => {
  it('drizzle migrations directory exists and is importable', () => {
    // Verifies the migrations object can be imported without error
    // The actual migration run is tested via manual verification (fresh install)
    expect(() => {
      // If migrations file doesn't exist, this require will throw
      require('../../drizzle/migrations');
    }).not.toThrow();
  });

  it('database client exports a db instance', () => {
    const clientModule = require('../../src/database/client');
    expect(clientModule.db).toBeDefined();
  });

  it('species schema table is defined', () => {
    const { species } = require('../../src/database/schema');
    expect(species).toBeDefined();
  });
});
