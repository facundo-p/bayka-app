import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import {
  activarIntegridadReferencial,
  ConexionSincrona,
  limpiarHuerfanos,
} from '../../src/database/integridadReferencial';

type Sqlite = InstanceType<typeof Database>;

/** El doble de la conexión sincrónica de expo-sqlite sobre better-sqlite3. */
const conexionDe = (sqlite: Sqlite): ConexionSincrona => ({
  execSync: (sql) => { sqlite.exec(sql); },
  getAllSync: <T>(sql: string, params: (string | number | null)[]) => sqlite.prepare(sql).all(...params) as T[],
  runSync: (sql, params) => sqlite.prepare(sql).run(...params),
});

/** Como una base de producción: migrada y con las FKs apagadas (better-sqlite3 las trae prendidas). */
function baseSinFks(): Sqlite {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = OFF');
  migrate(drizzle(sqlite), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  return sqlite;
}

const HOY = '2026-01-01T00:00:00';

function sembrarPlantacionCompleta(sqlite: Sqlite, id: string, especieId: string | null) {
  sqlite.prepare(`INSERT INTO plantations (id, organizacion_id, lugar, periodo, estado, creado_por, created_at)
    VALUES (?, 'org', 'Campo', '2026', 'activa', 'u1', ?)`).run(id, HOY);
  sqlite.prepare(`INSERT INTO parcelas (id, plantacion_id, nombre, codigo, created_at, updated_at)
    VALUES (?, ?, 'P', 'P1', ?, ?)`).run(`${id}-par`, id, HOY, HOY);
  sqlite.prepare(`INSERT INTO groups (id, plantacion_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
    VALUES (?, ?, ?, 'G', 'G1', 'linea', 'activa', 'u1', ?)`).run(`${id}-g`, id, `${id}-par`, HOY);
  sqlite.prepare(`INSERT INTO trees (id, group_id, especie_id, posicion, sub_id, usuario_registro, created_at)
    VALUES (?, ?, ?, 1, 'G1X1', 'u1', ?)`).run(`${id}-t`, `${id}-g`, especieId, HOY);
}

const cuenta = (sqlite: Sqlite, tabla: string) =>
  (sqlite.prepare(`SELECT count(*) AS n FROM ${tabla}`).get() as { n: number }).n;

describe('activarIntegridadReferencial', () => {
  let sqlite: Sqlite;
  beforeEach(() => { sqlite = baseSinFks(); });
  afterEach(() => sqlite.close());

  it('deja PRAGMA foreign_keys en 1', () => {
    activarIntegridadReferencial(conexionDe(sqlite));
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('una base con huérfanos arranca limpia y con FKs activas', () => {
    sembrarPlantacionCompleta(sqlite, 'viva', null);
    sembrarPlantacionCompleta(sqlite, 'borrada', null);
    sqlite.prepare("DELETE FROM plantations WHERE id = 'borrada'").run();

    activarIntegridadReferencial(conexionDe(sqlite));

    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(cuenta(sqlite, 'trees')).toBe(1);
  });

  it('borrar un padre con hijos vivos falla y no deja huérfanos', () => {
    sembrarPlantacionCompleta(sqlite, 'p1', null);
    activarIntegridadReferencial(conexionDe(sqlite));

    expect(() => sqlite.prepare("DELETE FROM groups WHERE id = 'p1-g'").run()).toThrow(/FOREIGN KEY/);
    expect(cuenta(sqlite, 'groups')).toBe(1);
  });

  it('si la limpieza falla, la app sigue sin FKs en vez de no arrancar', () => {
    const conexion = conexionDe(sqlite);
    const rota: ConexionSincrona = {
      ...conexion,
      getAllSync: () => { throw new Error('disco lleno'); },
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => activarIntegridadReferencial(rota)).not.toThrow();
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(0);
  });
});

describe('limpiarHuerfanos', () => {
  let sqlite: Sqlite;
  beforeEach(() => { sqlite = baseSinFks(); });
  afterEach(() => sqlite.close());

  it('borra en cascada lo que cuelga de una plantación que ya no está', () => {
    sembrarPlantacionCompleta(sqlite, 'borrada', null);
    sqlite.prepare(`INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion, assigned_at)
      VALUES ('borrada', 'u1', 'tecnico', ?)`).run(HOY);
    sqlite.prepare("DELETE FROM plantations WHERE id = 'borrada'").run();

    const r = limpiarHuerfanos(conexionDe(sqlite));

    expect(r.borradas).toEqual({ parcelas: 1, groups: 1, trees: 1, plantation_users: 1 });
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('recrea la especie que falta en vez de dejar el árbol sin especie', () => {
    sembrarPlantacionCompleta(sqlite, 'p1', 'sp-del-server');

    const r = limpiarHuerfanos(conexionDe(sqlite));

    expect(r).toEqual({ borradas: {}, especiesRecuperadas: 1 });
    const arbol = sqlite.prepare("SELECT especie_id FROM trees WHERE id = 'p1-t'").get() as { especie_id: string };
    expect(arbol.especie_id).toBe('sp-del-server');
    const especie = sqlite.prepare("SELECT id FROM species WHERE id = 'sp-del-server'").get();
    expect(especie).toBeDefined();
  });

  it('una especie usada por varias filas se recrea una sola vez', () => {
    sembrarPlantacionCompleta(sqlite, 'p1', 'sp-x');
    sqlite.prepare(`INSERT INTO plantation_species (id, plantacion_id, especie_id, orden_visual)
      VALUES ('ps', 'p1', 'sp-x', 0)`).run();

    expect(limpiarHuerfanos(conexionDe(sqlite)).especiesRecuperadas).toBe(1);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('una base sana no cambia', () => {
    sembrarPlantacionCompleta(sqlite, 'p1', null);
    expect(limpiarHuerfanos(conexionDe(sqlite))).toEqual({ borradas: {}, especiesRecuperadas: 0 });
    expect(cuenta(sqlite, 'trees')).toBe(1);
  });
});
