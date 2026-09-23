import { createTaggedLogger } from '../utils/taggedLogger';
import { localNow } from '../utils/dateUtils';

const dbLog = createTaggedLogger('DB');

type ValorSql = string | number | null;

/** Lo que este módulo usa de la conexión sincrónica de expo-sqlite; en tests, un doble sobre better-sqlite3. */
export interface ConexionSincrona {
  execSync(sql: string): void;
  getAllSync<T>(sql: string, params: ValorSql[]): T[];
  runSync(sql: string, params: ValorSql[]): { changes: number };
}

/** Fila de `PRAGMA foreign_key_check`. */
type Violacion = { table: string; rowid: number | null; parent: string; fkid: number };

export type ResultadoDeLimpieza = {
  /** Filas hijas borradas por tabla. */
  borradas: Record<string, number>;
  /** Especies recreadas como placeholder para no perder la especie de un árbol. */
  especiesRecuperadas: number;
};

const TABLA_ESPECIES = 'species';
const NOMBRE_ESPECIE_RECUPERADA = 'Especie desconocida';
/** Borrar una parcela huérfana destapa sus grupos, y esos sus árboles: una pasada por nivel. */
const PASADAS_MAXIMAS = 5;

function columnaDeLaFk(conexion: ConexionSincrona, v: Violacion): string {
  const fks = conexion.getAllSync<{ id: number; from: string }>(`PRAGMA foreign_key_list("${v.table}")`, []);
  const fk = fks.find((f) => f.id === v.fkid);
  if (!fk) throw new Error(`FK ${v.fkid} de ${v.table} no encontrada`);
  return fk.from;
}

/**
 * Una especie que falta se recrea con su id en vez de tocar el árbol: null lo volvería N/N y
 * al subir pisaría la especie real del server. El pull del catálogo la completa por id; si
 * queda sin referencias, `seedSpeciesIfNeeded` la borra.
 */
function recuperarEspecie(conexion: ConexionSincrona, v: Violacion): boolean {
  const columna = columnaDeLaFk(conexion, v);
  const [fila] = conexion.getAllSync<{ id: string }>(
    `SELECT "${columna}" AS id FROM "${v.table}" WHERE rowid = ?`, [v.rowid],
  );
  // Otra violación de la misma fila ya la borró.
  if (!fila) return false;
  const insertada = conexion.getAllSync<{ id: string }>(
    `INSERT OR IGNORE INTO ${TABLA_ESPECIES} (id, codigo, nombre, nombre_cientifico, created_at)
     VALUES (?, ?, ?, NULL, ?) RETURNING id`,
    [fila.id, fila.id, NOMBRE_ESPECIE_RECUPERADA, localNow()],
  );
  return insertada.length > 0;
}

function borrarHija(conexion: ConexionSincrona, v: Violacion, resultado: ResultadoDeLimpieza): void {
  const { changes } = conexion.runSync(`DELETE FROM "${v.table}" WHERE rowid = ?`, [v.rowid]);
  // Una fila con dos FKs rotas aparece dos veces; cuenta una.
  resultado.borradas[v.table] = (resultado.borradas[v.table] ?? 0) + changes;
}

function resolverViolacion(conexion: ConexionSincrona, v: Violacion, resultado: ResultadoDeLimpieza): void {
  if (v.parent !== TABLA_ESPECIES) return borrarHija(conexion, v, resultado);
  if (recuperarEspecie(conexion, v)) resultado.especiesRecuperadas++;
}

/** Resuelve lo que reporta `foreign_key_check` hasta dejarlo vacío. Debe correr en una transacción. */
function limpiarPasadas(conexion: ConexionSincrona): ResultadoDeLimpieza {
  const resultado: ResultadoDeLimpieza = { borradas: {}, especiesRecuperadas: 0 };
  for (let pasada = 0; pasada < PASADAS_MAXIMAS; pasada++) {
    const violaciones = conexion.getAllSync<Violacion>('PRAGMA foreign_key_check', []);
    if (violaciones.length === 0) return resultado;
    for (const v of violaciones) resolverViolacion(conexion, v, resultado);
  }
  throw new Error(`Quedan huérfanos tras ${PASADAS_MAXIMAS} pasadas`);
}

export function limpiarHuerfanos(conexion: ConexionSincrona): ResultadoDeLimpieza {
  conexion.execSync('BEGIN');
  try {
    const resultado = limpiarPasadas(conexion);
    conexion.execSync('COMMIT');
    return resultado;
  } catch (e) {
    conexion.execSync('ROLLBACK');
    throw e;
  }
}

/**
 * Limpia los huérfanos que dejaron versiones sin FKs y activa `PRAGMA foreign_keys` (#616).
 * Va después de las migraciones: las que reconstruyen tablas necesitan las FKs apagadas.
 * Si falla, la app arranca igual con las FKs apagadas, como antes.
 */
export function activarIntegridadReferencial(conexion: ConexionSincrona): void {
  try {
    const { borradas, especiesRecuperadas } = limpiarHuerfanos(conexion);
    // Fuera de la transacción: adentro, SQLite ignora el PRAGMA.
    conexion.execSync('PRAGMA foreign_keys = ON');
    dbLog.info(`FKs activas. Huérfanos borrados: ${JSON.stringify(borradas)}; especies recuperadas: ${especiesRecuperadas}`);
  } catch (e: any) {
    dbLog.error('No se pudieron activar las FKs:', e?.message ?? e);
  }
}
