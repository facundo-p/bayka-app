/**
 * Integration tests: Role-based access control.
 * Admin ve todas las plantaciones; tecnico solo las asignadas y nunca las
 * ocultas (visible_in_app=false). Corre la getPlantationsForRole real.
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import {
  plantations,
  parcelas,
  groups,
  trees,
  species,
  plantationSpecies,
  plantationUsers,
} from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
// Alias con prefijo mock-: jest solo permite referenciar variables `mock*`
// dentro del factory de jest.mock.
let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { getPlantationsForRole } from '../../src/queries/dashboardQueries';

const ADMIN_USER_ID = 'user-admin-001';
const TECNICO1_USER_ID = 'user-tecnico-001';
const TECNICO2_USER_ID = 'user-tecnico-002';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  mockTestDb = result.db;
  sqlite = result.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  // Clear data in FK order
  await db.delete(trees);
  await db.delete(groups);
  await db.delete(parcelas);
  await db.delete(plantationSpecies);
  await db.delete(plantationUsers);
  await db.delete(plantations);
  await db.delete(species);
});

/**
 * Helper: assign a user to a plantation via plantation_users
 */
async function assignUserToPlantation(userId: string, plantationId: string, role = 'tecnico') {
  await db.insert(plantationUsers).values({
    plantationId,
    userId,
    rolEnPlantacion: role,
    assignedAt: new Date().toISOString(),
  });
}

describe('Role-based access', () => {
  test('admin user sees all plantations in organization', async () => {
    const p1 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo A', creadoPor: ADMIN_USER_ID });
    const p2 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo B', creadoPor: ADMIN_USER_ID });
    const p3 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo C', creadoPor: ADMIN_USER_ID });
    await db.insert(plantations).values(p1);
    await db.insert(plantations).values(p2);
    await db.insert(plantations).values(p3);

    await assignUserToPlantation(TECNICO1_USER_ID, p1.id);
    await assignUserToPlantation(TECNICO1_USER_ID, p2.id);

    const result = await getPlantationsForRole(true, ADMIN_USER_ID);
    expect(result).toHaveLength(3);

    const ids = result.map(r => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(ids).toContain(p3.id);
  });

  test('tecnico sees only plantations assigned via plantation_users', async () => {
    const p1 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo A', creadoPor: ADMIN_USER_ID });
    const p2 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo B', creadoPor: ADMIN_USER_ID });
    const p3 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo C', creadoPor: ADMIN_USER_ID });
    await db.insert(plantations).values(p1);
    await db.insert(plantations).values(p2);
    await db.insert(plantations).values(p3);

    await assignUserToPlantation(TECNICO1_USER_ID, p1.id);
    await assignUserToPlantation(TECNICO1_USER_ID, p2.id);

    const result = await getPlantationsForRole(false, TECNICO1_USER_ID);
    expect(result).toHaveLength(2);

    const ids = result.map(r => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(ids).not.toContain(p3.id);
  });

  test('different tecnicos see only their own assigned plantations', async () => {
    const p1 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo A', creadoPor: ADMIN_USER_ID });
    const p2 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo B', creadoPor: ADMIN_USER_ID });
    await db.insert(plantations).values(p1);
    await db.insert(plantations).values(p2);

    await assignUserToPlantation(TECNICO1_USER_ID, p1.id);
    await assignUserToPlantation(TECNICO2_USER_ID, p2.id);

    const result1 = await getPlantationsForRole(false, TECNICO1_USER_ID);
    expect(result1).toHaveLength(1);
    expect(result1[0].id).toBe(p1.id);

    const result2 = await getPlantationsForRole(false, TECNICO2_USER_ID);
    expect(result2).toHaveLength(1);
    expect(result2[0].id).toBe(p2.id);
  });

  test('tecnico with no assignments sees empty list', async () => {
    const p1 = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo A', creadoPor: ADMIN_USER_ID });
    await db.insert(plantations).values(p1);

    const result = await getPlantationsForRole(false, TECNICO2_USER_ID);
    expect(result).toHaveLength(0);
  });

  test('admin sees all groups across all technicians', async () => {
    const plantation = createTestPlantation({ organizacionId: ORG_ID, creadoPor: ADMIN_USER_ID });
    await db.insert(plantations).values(plantation);
    // #90: parcela obligatoria — los groups de la factory referencian 'parcela-default'.
    await db.insert(parcelas).values(createTestParcela({ id: 'parcela-default', plantacionId: plantation.id }));

    const sg1 = createTestGroup({
      plantacionId: plantation.id,
      codigo: 'L01',
      nombre: 'Linea 01',
      usuarioCreador: TECNICO1_USER_ID,
    });
    const sg2 = createTestGroup({
      plantacionId: plantation.id,
      codigo: 'L02',
      nombre: 'Linea 02',
      usuarioCreador: TECNICO2_USER_ID,
    });
    await db.insert(groups).values(sg1);
    await db.insert(groups).values(sg2);

    const allGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.plantacionId, plantation.id));

    expect(allGroups).toHaveLength(2);

    const creators = allGroups.map(sg => sg.usuarioCreador);
    expect(creators).toContain(TECNICO1_USER_ID);
    expect(creators).toContain(TECNICO2_USER_ID);
  });

  test('tecnico no ve plantaciones ocultas desde la web (visible_in_app=false)', async () => {
    const visible = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo Visible', creadoPor: ADMIN_USER_ID });
    const oculta = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo Oculto', creadoPor: ADMIN_USER_ID, visibleInApp: false });
    await db.insert(plantations).values(visible);
    await db.insert(plantations).values(oculta);

    // Asignado a ambas: la oculta igual no debe aparecer en su listado.
    await assignUserToPlantation(TECNICO1_USER_ID, visible.id);
    await assignUserToPlantation(TECNICO1_USER_ID, oculta.id);

    const result = await getPlantationsForRole(false, TECNICO1_USER_ID);
    expect(result.map(r => r.id)).toEqual([visible.id]);
  });

  test('admin ve las plantaciones ocultas con el flag visibleInApp=false', async () => {
    const visible = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo Visible', creadoPor: ADMIN_USER_ID });
    const oculta = createTestPlantation({ organizacionId: ORG_ID, lugar: 'Campo Oculto', creadoPor: ADMIN_USER_ID, visibleInApp: false });
    await db.insert(plantations).values(visible);
    await db.insert(plantations).values(oculta);

    const result = await getPlantationsForRole(true, ADMIN_USER_ID);
    expect(result).toHaveLength(2);

    const byId = new Map(result.map(r => [r.id, r]));
    expect(byId.get(oculta.id)?.visibleInApp).toBe(false);
    expect(byId.get(visible.id)?.visibleInApp).toBe(true);
  });
});
