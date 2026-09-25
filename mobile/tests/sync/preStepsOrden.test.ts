/**
 * Orden de los pre-steps del push (#636): plantación → especies → técnicos, todos antes
 * del pull y de parcelas y grupos. El caché de técnicos se refresca después de subir,
 * así el aviso de un técnico rechazado todavía encuentra su nombre.
 */
const mockOrden: string[] = [];
const registrar = (paso: string, valor: unknown = []) => jest.fn(async () => { mockOrden.push(paso); return valor; });

jest.mock('../../src/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) } },
}));
// Las altas y las ediciones pendientes arrancan leyendo SQLite: cada lectura marca su paso.
jest.mock('../../src/database/client', () => ({
  db: {
    select: () => {
      mockOrden.push('plantaciones-o-ediciones');
      return { from: () => ({ where: () => Promise.resolve([]) }) };
    },
  },
}));
jest.mock('../../src/utils/syncLogger', () => ({ syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('../../src/services/sync/catalogoDeEspecies', () => ({ pullSpeciesFromServer: registrar('catalogo-especies', undefined) }));
jest.mock('../../src/services/sync/cambiosDeEspecies', () => ({
  ...jest.requireActual('../../src/services/sync/cambiosDeEspecies'),
  uploadPendingSpeciesChanges: registrar('especies'),
}));
jest.mock('../../src/services/sync/tecnicosDePlantacion', () => ({
  uploadPendingTechnicianAssignments: registrar('tecnicos', [
    { success: true, plantacionId: 'p1', nombre: 'Campo', tecnicosNoAsignados: ['Carla'] },
  ]),
}));
jest.mock('../../src/services/sync/catalogoDeTecnicos', () => ({ pullTecnicosDeOrganizacion: registrar('catalogo-tecnicos', undefined) }));

import { runGlobalPreSteps } from '../../src/services/sync/preSteps';

describe('runGlobalPreSteps — orden', () => {
  it('sube plantaciones, ediciones, especies y técnicos en ese orden, y después refresca el caché', async () => {
    const resultados = await runGlobalPreSteps();

    expect(mockOrden).toEqual([
      'catalogo-especies', 'plantaciones-o-ediciones', 'plantaciones-o-ediciones', 'especies', 'tecnicos', 'catalogo-tecnicos',
    ]);
    expect(resultados).toEqual([{ success: true, plantacionId: 'p1', nombre: 'Campo', tecnicosNoAsignados: ['Carla'] }]);
  });
});
