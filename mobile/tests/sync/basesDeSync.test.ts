// Bases que manda el push, respuesta `conservados` de sync_subgroup y path versionado de la foto (#795).
import {
  basesDeFotosQuitadas, basesDelArbol, camposDeGrupoCambiadosAca, gpsCambiadoAca, type ArbolDeGrupo,
} from '../../src/services/sync/basesDeSync';
import { leerConservados } from '../../src/services/sync/conservados';
import { pathDeFotoEnStorage } from '../../src/services/sync/storageUpload';
import type { Group } from '../../src/repositories/GroupRepository';

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

const arbol = (overrides: Partial<ArbolDeGrupo> = {}): ArbolDeGrupo => ({
  id: 't-1', groupId: 'g-1', especieId: 'sp-1', especieBaseId: 'sp-1', posicion: 1, subId: 'P1L1ROB1',
  fotoUrl: null, fotoSynced: false, plantacionId: null, globalId: null, usuarioRegistro: 'u-1',
  createdAt: '2026-01-01', latitude: null, longitude: null, gpsAccuracy: null, gpsCapturedAt: null,
  fotoBase: null, latitudeBase: null, longitudeBase: null, gpsCapturedAtBase: null,
  ...overrides,
});

const PUNTO = { latitude: -34.1, longitude: -58.1, gpsCapturedAt: '2026-10-01T10:00:00' };
const BASE = { latitudeBase: -34.1, longitudeBase: -58.1, gpsCapturedAtBase: '2026-10-01T10:00:00' };

describe('basesDelArbol', () => {
  it('sin punto base manda gps_base null: el teléfono no vio ninguno', () => {
    expect(basesDelArbol(arbol())).toEqual({ gps_base: null, foto_base: null });
  });

  it('con punto base lo manda sin la precisión', () => {
    expect(basesDelArbol(arbol({ ...BASE, fotoBase: 'plantations/p/trees/t-1-v1.jpg' }))).toEqual({
      gps_base: { latitude: -34.1, longitude: -58.1, gps_captured_at: '2026-10-01T10:00:00' },
      foto_base: 'plantations/p/trees/t-1-v1.jpg',
    });
  });

  // Bajada antes de que existieran las bases: el server no compara la foto.
  it('una copia local ya subida sin base no manda foto_base', () => {
    expect(basesDelArbol(arbol({ fotoUrl: 'file:///photos/t-1.jpg', fotoSynced: true }))).toEqual({ gps_base: null });
  });

  it('una foto nueva sin subir manda la base aunque sea null', () => {
    expect(basesDelArbol(arbol({ fotoUrl: 'file:///photos/t-1.jpg' }))).toHaveProperty('foto_base', null);
  });
});

describe('basesDeFotosQuitadas (#810)', () => {
  it('por árbol, la foto que el teléfono vio en el servidor', () => {
    expect(basesDeFotosQuitadas([
      arbol({ id: 't-1', fotoBase: 'plantations/p/trees/t-1-v1.jpg' }),
      arbol({ id: 't-2', fotoBase: 'plantations/p/trees/t-2.jpg' }),
    ])).toEqual({ 't-1': 'plantations/p/trees/t-1-v1.jpg', 't-2': 'plantations/p/trees/t-2.jpg' });
  });

  // Puede ser una foto bajada antes de que existieran las bases: el server la quita como antes.
  it('un árbol sin base va sin base', () => {
    expect(basesDeFotosQuitadas([arbol({ id: 't-1' }), arbol({ id: 't-2', fotoBase: 'p/t-2.jpg' })])).toEqual({ 't-2': 'p/t-2.jpg' });
  });

  it('sin árboles, nada', () => {
    expect(basesDeFotosQuitadas([])).toEqual({});
  });
});

describe('leerConservados de quitar_fotos_arboles (076)', () => {
  it('lee los árboles aunque no haya grupo', () => {
    const { grupo, arboles } = leerConservados({
      success: true, quitadas: 0, rechazados: [], conservados: { arboles: [{ id: 't-1', foto_url: 'p/t-1-v2.jpg' }] },
    });

    expect(grupo).toEqual({});
    expect(arboles.get('t-1')).toEqual({ fotoUrl: 'p/t-1-v2.jpg' });
  });
});

describe('gpsCambiadoAca', () => {
  it('compara latitud, longitud y momento de captura con la base, no la precisión', () => {
    expect(gpsCambiadoAca(arbol({ ...PUNTO, gpsAccuracy: 9, ...BASE }))).toBe(false);
    expect(gpsCambiadoAca(arbol({ ...PUNTO, gpsCapturedAt: '2026-10-02T10:00:00', ...BASE }))).toBe(true);
  });
});

describe('camposDeGrupoCambiadosAca', () => {
  const grupo = (overrides: Partial<Group>): Group => ({
    id: 'g-1', plantacionId: 'p-1', parcelaId: 'pa-1', nombre: 'Uno', codigo: 'L1', tipo: 'linea', estado: 'activa',
    usuarioCreador: 'u-1', createdAt: '2026-01-01', pendingSync: true, baseDelServidor: null, ...overrides,
  });

  it('sin base no se sabe: ninguno', () => {
    expect(camposDeGrupoCambiadosAca(grupo({ nombre: 'Otro' }))).toEqual(new Set());
  });

  it('los que difieren de la base', () => {
    const base = { nombre: 'Uno', codigo: 'L1', tipo: 'linea', estado: 'finalizada' };
    expect(camposDeGrupoCambiadosAca(grupo({ nombre: 'Otro', baseDelServidor: base }))).toEqual(new Set(['nombre', 'estado']));
  });
});

describe('leerConservados', () => {
  it('lee el grupo y los árboles de `conservados`', () => {
    const conservados = leerConservados({
      success: true,
      conservadas: [],
      conservados: {
        grupo: { nombre: 'Uno admin', otro: 'x' },
        arboles: [
          { id: 't-1', foto_url: null },
          { id: 't-2', species_id: 'sp-2', gps: { latitude: -34.2, longitude: -58.2, gps_accuracy: 3, gps_captured_at: '2026-10-02' } },
        ],
      },
    });

    expect(conservados.grupo).toEqual({ nombre: 'Uno admin' });
    expect(conservados.arboles.get('t-1')).toEqual({ fotoUrl: null });
    expect(conservados.arboles.get('t-2')).toEqual({
      especieId: 'sp-2',
      gps: { latitude: -34.2, longitude: -58.2, gpsAccuracy: 3, gpsCapturedAt: '2026-10-02' },
    });
  });

  it('un server sin 075 solo manda `conservadas`: la especie', () => {
    const conservados = leerConservados({ success: true, conservadas: [{ id: 't-1', species_id: 'sp-2' }] });

    expect(conservados.grupo).toEqual({});
    expect(conservados.arboles.get('t-1')).toEqual({ especieId: 'sp-2' });
  });

  it('sin respuesta, nada', () => {
    expect(leerConservados(null).arboles.size).toBe(0);
  });
});

describe('pathDeFotoEnStorage', () => {
  const ubicacion = { treeId: 't-1', plantacionId: 'p-1', parcelaId: 'pa-1' };

  it('versiona con el nombre del archivo local, solo letras y números', () => {
    expect(pathDeFotoEnStorage(ubicacion, 'file:///data/photos/photo_1728400000000.jpg'))
      .toBe('plantations/p-1/parcelas/pa-1/trees/t-1-photo1728400000000.jpg');
  });

  it('sin nombre usable queda el path sin versión', () => {
    expect(pathDeFotoEnStorage(ubicacion, 'file:///data/photos/_.jpg')).toBe('plantations/p-1/parcelas/pa-1/trees/t-1.jpg');
  });
});
