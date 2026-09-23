import { backupsABorrar, MAX_VIVOS } from './backupRetention.cjs';

// Miércoles: la semana arranca el lunes 21.
const HOY = Date.UTC(2026, 8, 23);
const MS_POR_DIA = 86_400_000;

function key(fecha: string, hora = '050000') {
  return `supabase-backups/backup-${fecha.replaceAll('-', '')}-${hora}.dump`;
}

/** Un backup diario a las 5am desde `desde` hasta HOY inclusive. */
function diarios(desde: string) {
  const keys: string[] = [];
  for (let t = Date.parse(desde); t <= HOY; t += MS_POR_DIA) {
    keys.push(key(new Date(t).toISOString().slice(0, 10)));
  }
  return keys;
}

function vivos(keys: string[]) {
  const borrar = new Set(backupsABorrar(keys, HOY));
  return keys.filter((k) => !borrar.has(k)).sort();
}

describe('backupsABorrar', () => {
  it('con un año de diarios deja 7 diarios, 4 semanales y 12 mensuales', () => {
    expect(vivos(diarios('2025-09-23'))).toEqual(
      [
        // Mensuales: el primero de cada mes, octubre 2025 a septiembre 2026.
        '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01',
        '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
        // Semanales: los lunes desde el 31/8; el 1/9 es el mensual de septiembre.
        '2026-08-31', '2026-09-01', '2026-09-07', '2026-09-14',
        // Diarios: los últimos 7 días, con el lunes 21 como semanal.
        '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23',
      ].map((f) => key(f)),
    );
  });

  it('nunca supera la cota de vivos', () => {
    expect(vivos(diarios('2024-01-01')).length).toBeLessThanOrEqual(MAX_VIVOS);
  });

  it('ordena por el nombre, no por el orden en que llegan las keys', () => {
    const keys = diarios('2026-06-01');
    const mezcladas = [...keys].reverse();
    expect(backupsABorrar(mezcladas, HOY).sort()).toEqual(backupsABorrar(keys, HOY).sort());
  });

  it('con varios backups en un día conserva el primero y el más nuevo', () => {
    const keys = [key('2026-09-23', '050000'), key('2026-09-23', '120000'), key('2026-09-23', '214606')];
    expect(backupsABorrar(keys, HOY)).toEqual([key('2026-09-23', '120000')]);
  });

  it('borra todo lo que quedó fuera de las ventanas, salvo el más nuevo', () => {
    const viejos = [key('2024-03-01'), key('2024-04-01'), key('2024-05-01')];
    expect(backupsABorrar(viejos, HOY)).toEqual([key('2024-03-01'), key('2024-04-01')]);
  });

  it('no toca una key con otro formato', () => {
    const raro = 'supabase-backups/manual-antes-del-cutover.dump';
    expect(backupsABorrar([raro, ...diarios('2026-01-01')], HOY)).not.toContain(raro);
  });

  it('sin backups no borra nada', () => {
    expect(backupsABorrar([], HOY)).toEqual([]);
  });
});
