/**
 * Regresión: drizzle-expo aplica una migración solo si su `when` es mayor que
 * el `created_at` máximo ya registrado en el device. Si una migración nueva
 * tiene `when` menor, se SALTEA silenciosamente y useMigrations igual reporta
 * success → columnas faltantes en runtime (bug real: "no such column:
 * trees.latitude").
 *
 * Invariante enforzada desde idx >= FIRST_ENFORCED_IDX: `when` debe ser
 * estrictamente mayor que el máximo de todas las anteriores.
 *
 * Excepción: 0008–0014 ya están desplegadas con timestamps menores a las
 * 0000–0007 y no se pueden corregir sin re-disparar sus ALTER en devices
 * existentes.
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
