/**
 * Regresión: drizzle-expo aplica una migración solo si su `when` (folderMillis)
 * es MAYOR que el máximo `created_at` ya registrado en el device
 * (sqlite-core/dialect: `lastDbMigration.created_at < migration.folderMillis`).
 * Si una migración nueva tiene `when` menor que el de alguna anterior, en un
 * device que ya pasó por esa anterior la nueva se SALTEA silenciosamente y
 * useMigrations igual reporta success → columnas faltantes en runtime
 * (bug real: "no such column: trees.latitude", el milestone GPS).
 *
 * Invariante que enforzamos hacia adelante: toda migración con idx >= FIRST_ENFORCED
 * debe tener `when` estrictamente mayor que el máximo de TODAS las anteriores.
 *
 * Excepción histórica: las 0008–0014 ya están desplegadas con timestamps
 * redondos menores que las 0000–0007 (auto-generadas en 2026). No se pueden
 * corregir sin re-disparar sus ALTER en devices existentes. Se documentan acá.
 */
import journal from '../../drizzle/meta/_journal.json';

const LEGACY_NON_MONOTONIC = new Set([8, 9, 10, 11, 12, 13, 14]);
const FIRST_ENFORCED_IDX = 15;

describe('journal de migraciones drizzle', () => {
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  it('cada migración nueva (idx >= 15) tiene when mayor que todas las anteriores', () => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.idx < FIRST_ENFORCED_IDX) continue;
      const maxPrev = Math.max(...entries.slice(0, i).map((e) => e.when));
      expect(entry.when).toBeGreaterThan(maxPrev);
    }
  });

  it('las violaciones conocidas son solo las históricas documentadas (0008–0014)', () => {
    const offenders: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const maxPrev = Math.max(...entries.slice(0, i).map((e) => e.when));
      if (entries[i].when <= maxPrev) offenders.push(entries[i].idx);
    }
    // Si aparece un idx fuera del set legacy, alguien repitió el bug del timestamp.
    expect(offenders.filter((idx) => !LEGACY_NON_MONOTONIC.has(idx))).toEqual([]);
  });

  it('idx y tag de cada entry son únicos y consecutivos desde 0', () => {
    entries.forEach((entry, i) => expect(entry.idx).toBe(i));
    expect(new Set(entries.map((e) => e.tag)).size).toBe(entries.length);
  });
});
