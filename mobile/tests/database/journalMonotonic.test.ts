/**
 * Regresión: drizzle-expo aplica una migración solo si su `when` es mayor que
 * el `created_at` máximo ya registrado en el device. Si una migración nueva
 * tiene `when` menor, se SALTEA silenciosamente y useMigrations igual reporta
 * success → columnas faltantes en runtime (bug real: "no such column:
 * trees.latitude").
 *
 * 0008–0014 tenían timestamps menores a 0000–0007 (issue #312); renumerados
 * porque todo device operativo está en idx >= 15 y nunca los re-aplica
 * (drizzle-orm/sqlite-core/dialect.js, SQLiteSyncDialect.migrate: usa el
 * created_at MAX ya registrado, no camina el journal en orden). El invariante
 * ahora cubre el journal entero.
 */
import journal from '../../drizzle/meta/_journal.json';

describe('journal de migraciones drizzle', () => {
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  it('cada migración tiene when mayor que todas las anteriores', () => {
    for (let i = 1; i < entries.length; i++) {
      const maxPrev = Math.max(...entries.slice(0, i).map((e) => e.when));
      expect(entries[i].when).toBeGreaterThan(maxPrev);
    }
  });

  it('idx y tag de cada entry son únicos y consecutivos desde 0', () => {
    entries.forEach((entry, i) => expect(entry.idx).toBe(i));
    expect(new Set(entries.map((e) => e.tag)).size).toBe(entries.length);
  });

  it('ninguna entry idx < 15 tiene when >= la de la 0015 (guarda la renumeración de 0008-0014)', () => {
    const floor = entries.find((e) => e.idx === 15)!;
    for (const entry of entries.filter((e) => e.idx < 15)) {
      expect(entry.when).toBeLessThan(floor.when);
    }
  });
});
