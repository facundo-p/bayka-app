/**
 * Retención escalonada de los backups de la base (#604): uno por día en la
 * última semana, uno por semana en el último mes y uno por mes en el último
 * año — unos 21 dumps vivos en régimen.
 *
 * La fecha sale del nombre (`backup-YYYYMMDD-HHMMSS.dump`), nunca de
 * LastModified: copiar objetos entre buckets reescribe esa fecha.
 *
 * Uso desde `supabase-backup.sh`: recibe las keys por stdin, una por línea, e
 * imprime las que hay que borrar.
 *
 *     node scripts/backupRetention.cjs [YYYYMMDD] < keys.txt
 */

const RETENCION = { dias: 7, semanas: 4, meses: 12 };

/** Cota superior de dumps vivos: las tres ventanas sin solaparse. */
const MAX_VIVOS = RETENCION.dias + RETENCION.semanas + RETENCION.meses;

const NOMBRE_BACKUP = /backup-(\d{4})(\d{2})(\d{2})-\d{6}\.dump$/;
const MS_POR_DIA = 86_400_000;

/** @returns {number | null} medianoche UTC del día del backup */
function diaDe(key) {
  const m = NOMBRE_BACKUP.exec(key);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Lunes (UTC) de la semana del día: la semana ISO arranca el lunes. */
function lunesDe(dia) {
  const diasDesdeLunes = (new Date(dia).getUTCDay() + 6) % 7;
  return dia - diasDesdeLunes * MS_POR_DIA;
}

function primeroDelMes(dia, mesesAtras = 0) {
  const d = new Date(dia);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - mesesAtras, 1);
}

/**
 * Keys a borrar. Se conserva el primer backup de cada día, semana y mes dentro
 * de su ventana, y siempre el más nuevo. Una key con otro formato nunca se
 * borra: lo que no se entiende no se toca.
 *
 * @param {string[]} keys
 * @param {number} hoy medianoche UTC del día de la corrida
 * @returns {string[]}
 */
function backupsABorrar(keys, hoy) {
  const fechados = keys
    .map((key) => ({ key, dia: diaDe(key) }))
    .filter((b) => b.dia !== null)
    .sort((a, b) => (a.key < b.key ? -1 : 1));

  const ventanas = [
    { desde: hoy - (RETENCION.dias - 1) * MS_POR_DIA, balde: (d) => d },
    { desde: lunesDe(hoy) - (RETENCION.semanas - 1) * 7 * MS_POR_DIA, balde: lunesDe },
    { desde: primeroDelMes(hoy, RETENCION.meses - 1), balde: (d) => primeroDelMes(d) },
  ];

  const conservar = new Set();
  if (fechados.length) conservar.add(fechados[fechados.length - 1].key);

  for (const { desde, balde } of ventanas) {
    const vistos = new Set();
    for (const { key, dia } of fechados) {
      if (dia < desde || vistos.has(balde(dia))) continue;
      vistos.add(balde(dia));
      conservar.add(key);
    }
  }

  return fechados.filter((b) => !conservar.has(b.key)).map((b) => b.key);
}

function hoyUtc(argumento) {
  if (!argumento) {
    const ahora = new Date();
    return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  }
  const dia = diaDe(`backup-${argumento}-000000.dump`);
  if (dia === null) throw new Error(`Fecha inválida: ${argumento} (se espera YYYYMMDD)`);
  return dia;
}

if (require.main === module) {
  const keys = require('node:fs').readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const key of backupsABorrar(keys, hoyUtc(process.argv[2]))) console.log(key);
}

module.exports = { backupsABorrar, MAX_VIVOS };
