/**
 * Regresión del bug de timestamps invertidos (#312): drizzle-orm/sqlite-core/dialect.js,
 * SQLiteSyncDialect.migrate (usada por expo-sqlite) lee el `created_at` MAX ya registrado
 * en __drizzle_migrations con un solo `SELECT ... ORDER BY created_at DESC LIMIT 1` (línea 654)
 * y solo aplica una migración si su `when` es estrictamente mayor a ese máximo (línea 660) — no
 * camina el journal en orden ni vuelve a consultar el máximo dentro del loop.
 *
 * Contrato asumido (issue #312, aprobado): ningún device operativo quedó en un estado anterior a
 * este fix — todos ya están en idx >= 15 (max created_at >= 1774300000000, el `when` de la 0015).
 * Este test simula exactamente ese piso: un device que ya migró 0000-0015 y luego recibe una
 * actualización con el journal completo (hasta 0019). Verifica que 0008-0014 (renumeradas a
 * `when` entre las de 0007 y 0015, ver drizzle/meta/_journal.json) NO se reaplican — evitando los
 * "duplicate column"/"table already exists" que dispararían si drizzle intentara correrlas de
 * nuevo — y que 0016-0019 sí se aplican.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import os from 'os';
import path from 'path';
import journal from '../../drizzle/meta/_journal.json';

const DRIZZLE_DIR = path.join(__dirname, '../../drizzle');
const DEVICE_FLOOR_IDX = 15; // Piso asumido: ningún device operativo está por debajo de esto.
const DEVICE_FLOOR_WHEN = journal.entries.find((e) => e.idx === DEVICE_FLOOR_IDX)!.when;

type MigrationRow = { hash: string; created_at: number };

function columnNames(sqlite: InstanceType<typeof Database>, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map((row) => row.name);
}

function appliedMigrations(sqlite: InstanceType<typeof Database>): MigrationRow[] {
  return sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY id').all() as MigrationRow[];
}

/** Carpeta de migraciones truncada a idx <= upToIdx, con copias de los .sql reales — simula el journal que un device vio en su primer install. */
function buildTruncatedMigrationsFolder(upToIdx: number): string {
  const entries = journal.entries.filter((e) => e.idx <= upToIdx);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bayka-migrations-'));
  fs.mkdirSync(path.join(dir, 'meta'));
  fs.writeFileSync(path.join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const entry of entries) {
    fs.copyFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), path.join(dir, `${entry.tag}.sql`));
  }
  return dir;
}

test('device en idx 15 no reaplica 0008-0014 y sí aplica 0016-0019 al actualizar', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  // Instalación limpia que llega hasta 0015 (piso asumido de todo device operativo).
  const partialDir = buildTruncatedMigrationsFolder(DEVICE_FLOOR_IDX);
  try {
    migrate(db, { migrationsFolder: partialDir });
  } finally {
    fs.rmSync(partialDir, { recursive: true, force: true });
  }

  const afterPhase1 = appliedMigrations(sqlite);
  expect(afterPhase1).toHaveLength(DEVICE_FLOOR_IDX + 1);
  expect(Math.max(...afterPhase1.map((r) => Number(r.created_at)))).toBe(DEVICE_FLOOR_WHEN);

  // La app se actualiza y trae el journal completo (hasta 0019).
  expect(() => migrate(db, { migrationsFolder: DRIZZLE_DIR })).not.toThrow();

  const afterPhase2 = appliedMigrations(sqlite);
  expect(afterPhase2).toHaveLength(journal.entries.length); // nada se reaplicó dos veces

  expect(columnNames(sqlite, 'plantations')).toEqual(
    expect.arrayContaining([
      'gps_capture_frequency_server',
      'gps_capture_required_server',
      'visible_in_app',
      'photo_capture_all_trees',
      'archivada_en',
      'eliminada_en_servidor_en',
      'motivo_varado',
      'alta_en_servidor',
      'codigo',
      'codigo_server',
    ]),
  );
  expect(columnNames(sqlite, 'parcelas')).toContain('alta_pendiente_de');
  expect(columnNames(sqlite, 'trees')).toContain('especie_base_id');
  expect(columnNames(sqlite, 'trees')).not.toContain('conflict_especie_id');
  expect(columnNames(sqlite, 'trees')).not.toContain('conflict_especie_nombre');

  sqlite.close();
});

/** Base nueva migrada hasta la migración `tag` inclusive: un device que todavía no vio las siguientes. */
function migrarHasta(db: ReturnType<typeof drizzle>, tag: string): void {
  const idx = journal.entries.find((e) => e.tag === tag)!.idx;
  const partialDir = buildTruncatedMigrationsFolder(idx);
  try {
    migrate(db, { migrationsFolder: partialDir });
  } finally {
    fs.rmSync(partialDir, { recursive: true, force: true });
  }
}

// g1 ya subido, g2 con cambios sin subir.
const PADRES_DE_ARBOLES_SQL = `
  INSERT INTO plantations (id, organizacion_id, lugar, periodo, estado, creado_por, created_at)
    VALUES ('p1', 'o1', 'Campo', '2026', 'activa', 'u1', '2026-01-01');
  INSERT INTO parcelas (id, plantacion_id, nombre, codigo, created_at, updated_at)
    VALUES ('pa1', 'p1', 'Norte', 'P1', '2026-01-01', '2026-01-01');
  INSERT INTO groups (id, plantacion_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
    VALUES ('g1', 'p1', 'pa1', 'Uno', 'L1', 'linea', 'activa', 'u1', '2026-01-01');
  INSERT INTO groups (id, plantacion_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at, pending_sync)
    VALUES ('g2', 'p1', 'pa1', 'Dos', 'L2', 'linea', 'activa', 'u1', '2026-01-01', 1);
  INSERT INTO species (id, codigo, nombre, created_at) VALUES ('sp1', 'ROB', 'Roble', '2026-01-01');
`;

// 0031 (#679): la base de un árbol que ya estaba es su especie local, salvo en un
// grupo sin subir, donde no se sabe y queda como N/N.
test('0031 arranca la especie base con la local, salvo en un grupo sin subir', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrarHasta(db, '0030_plantations_codigo');
  sqlite.exec(PADRES_DE_ARBOLES_SQL);
  sqlite.exec(`
    INSERT INTO trees (id, group_id, especie_id, posicion, sub_id, usuario_registro, created_at) VALUES
      ('t1', 'g1', 'sp1', 1, 'P1L1ROB1', 'u1', '2026-01-01'),
      ('t2', 'g1', NULL, 2, 'P1L1NN2', 'u1', '2026-01-01'),
      ('t3', 'g2', 'sp1', 1, 'P1L2ROB1', 'u1', '2026-01-01');
  `);

  migrate(db, { migrationsFolder: DRIZZLE_DIR });

  const filas = sqlite.prepare('SELECT id, especie_base_id FROM trees ORDER BY id').all();
  expect(filas).toEqual([
    { id: 't1', especie_base_id: 'sp1' },
    { id: 't2', especie_base_id: null },
    { id: 't3', especie_base_id: null },
  ]);
  sqlite.close();
});

// 0033 (#741): dropea las columnas de conflicto sin perder árboles ni el resto de sus datos.
test('0033 dropea conflict_especie_* y conserva los árboles', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrarHasta(db, '0032_species_tipo_subtipo');
  sqlite.exec(PADRES_DE_ARBOLES_SQL);
  sqlite.exec(`
    INSERT INTO trees (id, group_id, especie_id, posicion, sub_id, usuario_registro, created_at,
                       especie_base_id, conflict_especie_id, conflict_especie_nombre) VALUES
      ('t1', 'g1', 'sp1', 1, 'P1L1ROB1', 'u1', '2026-01-01', 'sp1', 'sp9', 'Pino'),
      ('t2', 'g2', NULL, 1, 'P1L2NN1', 'u1', '2026-01-01', NULL, NULL, NULL);
  `);
  const columnasAntes = columnNames(sqlite, 'trees');

  migrarHasta(db, '0033_trees_drop_conflict_especie');

  expect(columnNames(sqlite, 'trees')).toEqual(
    columnasAntes.filter((c) => c !== 'conflict_especie_id' && c !== 'conflict_especie_nombre'),
  );
  const filas = sqlite
    .prepare('SELECT id, group_id, especie_id, sub_id, especie_base_id FROM trees ORDER BY id')
    .all();
  expect(filas).toEqual([
    { id: 't1', group_id: 'g1', especie_id: 'sp1', sub_id: 'P1L1ROB1', especie_base_id: 'sp1' },
    { id: 't2', group_id: 'g2', especie_id: null, sub_id: 'P1L2NN1', especie_base_id: null },
  ]);
  sqlite.close();
});

// 0034 (#795): en un grupo ya subido la base es el valor local; la foto, solo si
// es un path de Storage. En un grupo sin subir no se sabe y queda sin base.
test('0034 arranca las bases de GPS, foto y grupo con lo local, salvo en un grupo sin subir', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrarHasta(db, '0033_trees_drop_conflict_especie');
  sqlite.exec(PADRES_DE_ARBOLES_SQL);
  sqlite.exec(`
    INSERT INTO trees (id, group_id, especie_id, posicion, sub_id, usuario_registro, created_at,
                       foto_url, latitude, longitude, gps_captured_at) VALUES
      ('t1', 'g1', 'sp1', 1, 'P1L1ROB1', 'u1', '2026-01-01', 'plantations/p1/trees/t1.jpg', -34.1, -58.1, '2026-01-02'),
      ('t2', 'g1', 'sp1', 2, 'P1L1ROB2', 'u1', '2026-01-01', 'file:///photos/t2.jpg', NULL, NULL, NULL),
      ('t3', 'g2', 'sp1', 1, 'P1L2ROB1', 'u1', '2026-01-01', 'plantations/p1/trees/t3.jpg', -34.3, -58.3, '2026-01-02');
  `);

  migrate(db, { migrationsFolder: DRIZZLE_DIR });

  expect(sqlite.prepare(
    'SELECT id, foto_base, latitude_base, longitude_base, gps_captured_at_base FROM trees ORDER BY id',
  ).all()).toEqual([
    { id: 't1', foto_base: 'plantations/p1/trees/t1.jpg', latitude_base: -34.1, longitude_base: -58.1, gps_captured_at_base: '2026-01-02' },
    { id: 't2', foto_base: null, latitude_base: null, longitude_base: null, gps_captured_at_base: null },
    { id: 't3', foto_base: null, latitude_base: null, longitude_base: null, gps_captured_at_base: null },
  ]);
  const bases = sqlite.prepare('SELECT id, base_del_servidor FROM groups ORDER BY id').all() as { id: string; base_del_servidor: string | null }[];
  expect(bases.map((g) => [g.id, g.base_del_servidor && JSON.parse(g.base_del_servidor)])).toEqual([
    ['g1', { nombre: 'Uno', codigo: 'L1', tipo: 'linea', estado: 'activa' }],
    ['g2', null],
  ]);
  expect(columnNames(sqlite, 'conflictos_de_sync')).toEqual(
    ['entidad_id', 'campo', 'grupo_id', 'plantacion_id', 'mio', 'servidor', 'detectado_en'],
  );
  sqlite.close();
});
