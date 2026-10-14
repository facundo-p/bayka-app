/**
 * contracts/tipos-especie.json contra la base local (#752): los DEFAULT de la migración 0032 son
 * los que reciben las especies que ya estaban y las que se insertan con SQL crudo, como el
 * placeholder de una especie recuperada. El server los recorre en pgTAP.
 */
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from '../helpers/integrationDb';
import { leerContrato } from '../helpers/contratos';

let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  sqlite = createTestDb().sqlite;
});

afterAll(() => closeTestDb(sqlite));

/** `dflt_value` de PRAGMA table_info trae el literal SQL, con comillas. */
function defaultDe(columna: string): string | undefined {
  const columnas = sqlite.prepare('PRAGMA table_info(species)').all() as { name: string; dflt_value: string | null }[];
  return columnas.find((c) => c.name === columna)?.dflt_value?.replace(/^'(.*)'$/, '$1');
}

it('los DEFAULT de tipo y subtipo en SQLite son la clasificación por defecto del contrato', () => {
  const { porDefecto } = leerContrato('tipos-especie.json') as { porDefecto: { tipo: string; subtipo: string } };
  expect({ tipo: defaultDe('tipo'), subtipo: defaultDe('subtipo') }).toEqual(porDefecto);
});
