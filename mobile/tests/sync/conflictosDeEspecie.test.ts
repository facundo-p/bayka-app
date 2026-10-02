/** Cuándo el pull deja la especie en manos del usuario (#679). */
jest.mock('../../src/database/client', () => ({ db: {} }));

import {
  chocaLaEspecie, conflictoDisuelto, especiesConservadas, type ArbolLocal,
} from '../../src/services/sync/conflictosDeEspecie';

const local = (especieId: string | null, especieBaseId: string | null, conflictEspecieId: string | null = null): ArbolLocal => ({
  especieId, especieBaseId, conflictEspecieId, fotoUrl: null, fotoSynced: false,
});
const remoto = (speciesId: string | null) => ({ id: 't1', species_id: speciesId });

describe('chocaLaEspecie — grupo con cambios sin subir', () => {
  it('los dos lados cambiaron, a especies distintas', () => {
    expect(chocaLaEspecie(remoto('pino'), local('roble', 'alamo'), true)).toBe(true);
  });

  it('solo cambió el server: lo resuelve sync_subgroup, no el usuario', () => {
    expect(chocaLaEspecie(remoto('pino'), local('roble', 'roble'), true)).toBe(false);
  });

  it('solo cambió el dispositivo', () => {
    expect(chocaLaEspecie(remoto('alamo'), local('roble', 'alamo'), true)).toBe(false);
  });

  it('los dos cambiaron a la misma', () => {
    expect(chocaLaEspecie(remoto('roble'), local('roble', 'alamo'), true)).toBe(false);
  });

  it('un N/N resuelto acá y en el server, distinto', () => {
    expect(chocaLaEspecie(remoto('pino'), local('roble', null), true)).toBe(true);
  });

  it('un N/N del server nunca choca', () => {
    expect(chocaLaEspecie(remoto(null), local('roble', 'alamo'), true)).toBe(false);
  });

  it('un árbol que no está local no choca', () => {
    expect(chocaLaEspecie(remoto('pino'), undefined, true)).toBe(false);
  });
});

describe('chocaLaEspecie — grupo ya subido', () => {
  it('sin conflicto anterior: el pull adopta la del server', () => {
    expect(chocaLaEspecie(remoto('pino'), local('roble', 'roble'), false)).toBe(false);
  });

  it('con un conflicto sin resolver: sigue marcado', () => {
    expect(chocaLaEspecie(remoto('pino'), local('roble', 'alamo', 'pino'), false)).toBe(true);
  });

  it('con un conflicto que el server ya resolvió a la local', () => {
    expect(chocaLaEspecie(remoto('roble'), local('roble', 'alamo', 'pino'), false)).toBe(false);
  });
});

describe('conflictoDisuelto', () => {
  it('grupo pendiente marcado y el server pasó a la local', () => {
    expect(conflictoDisuelto(remoto('roble'), local('roble', 'alamo', 'pino'), true)).toBe(true);
  });

  it('grupo pendiente marcado y el server volvió a la base', () => {
    expect(conflictoDisuelto(remoto('alamo'), local('roble', 'alamo', 'pino'), true)).toBe(true);
  });

  it('el choque sigue: no se limpia', () => {
    expect(conflictoDisuelto(remoto('cedro'), local('roble', 'alamo', 'pino'), true)).toBe(false);
  });

  it('sin marca no hay nada que limpiar', () => {
    expect(conflictoDisuelto(remoto('roble'), local('roble', 'alamo'), true)).toBe(false);
  });

  it('en un grupo ya subido lo limpia el upsert, no esto', () => {
    expect(conflictoDisuelto(remoto('roble'), local('roble', 'roble', 'pino'), false)).toBe(false);
  });
});

describe('especiesConservadas', () => {
  it('lee los árboles en los que el server se quedó con su especie', () => {
    expect(especiesConservadas({ success: true, conservadas: [{ id: 't1', species_id: 'pino' }] }))
      .toEqual([{ id: 't1', species_id: 'pino' }]);
  });

  it('un server sin 064 no las manda', () => {
    expect(especiesConservadas({ success: true })).toEqual([]);
    expect(especiesConservadas(null)).toEqual([]);
  });

  it('descarta entradas mal formadas', () => {
    expect(especiesConservadas({ conservadas: [{ id: 't1' }, null, { id: 't2', species_id: 'pino' }] }))
      .toEqual([{ id: 't2', species_id: 'pino' }]);
  });
});
