// Contrato con `estado_remoto_plantaciones` (#478): los valores del RPC van como
// literales a propósito, para que un cambio de contrato rompa acá.
import {
  pullDesdeEstadoRemoto,
  existeConAcceso,
  esEliminada,
  esSinAcceso,
  esPullSinDatos,
  PULL_OK,
} from '../../src/services/sync/types';
import { esFuncionInexistente } from '../../src/supabase/postgresErrorCodes';
import { plantacionesOmitidas, hayOmitidas } from '../../src/services/sync/plantacionesOmitidas';

describe('pullDesdeEstadoRemoto', () => {
  it.each([
    ['ok', 'ok'],
    ['archivada', 'ok'],
    ['eliminada', 'eliminada'],
    ['sin_acceso', 'sin-acceso'],
  ])('%s → %s', (remoto, pull) => {
    expect(pullDesdeEstadoRemoto(remoto)).toEqual({ estado: pull });
  });

  it('un valor desconocido o ausente asume acceso: solo se corta ante evidencia', () => {
    expect(pullDesdeEstadoRemoto('algo-nuevo')).toEqual(PULL_OK);
    expect(pullDesdeEstadoRemoto(undefined)).toEqual(PULL_OK);
    expect(pullDesdeEstadoRemoto(null)).toEqual(PULL_OK);
  });
});

describe('existeConAcceso', () => {
  it('solo ok y archivada desmarcan una eliminada', () => {
    expect(existeConAcceso('ok')).toBe(true);
    expect(existeConAcceso('archivada')).toBe(true);
    expect(existeConAcceso('eliminada')).toBe(false);
    expect(existeConAcceso('sin_acceso')).toBe(false);
    expect(existeConAcceso(undefined)).toBe(false);
  });
});

describe('predicados de PullResult', () => {
  it('esPullSinDatos cubre sin acceso y eliminada, no ok', () => {
    expect(esPullSinDatos({ estado: 'eliminada' })).toBe(true);
    expect(esPullSinDatos({ estado: 'sin-acceso' })).toBe(true);
    expect(esPullSinDatos({ estado: 'ok' })).toBe(false);
  });

  it('eliminada y sin acceso no se confunden', () => {
    expect(esEliminada({ estado: 'sin-acceso' })).toBe(false);
    expect(esSinAcceso({ estado: 'eliminada' })).toBe(false);
  });
});

describe('esFuncionInexistente', () => {
  it('reconoce el RPC ausente por SQLSTATE y por código de PostgREST', () => {
    expect(esFuncionInexistente({ code: '42883' })).toBe(true);
    expect(esFuncionInexistente({ code: 'PGRST202' })).toBe(true);
  });

  it('cualquier otro error no es "server viejo"', () => {
    expect(esFuncionInexistente({ code: '42501' })).toBe(false);
    expect(esFuncionInexistente({ message: 'Network request failed' })).toBe(false);
    expect(esFuncionInexistente(null)).toBe(false);
  });
});

describe('plantacionesOmitidas', () => {
  const base = { results: [], parcelas: [] };

  it('separa sin acceso de eliminadas, por nombre y en orden', () => {
    const omitidas = plantacionesOmitidas([
      { ...base, plantationId: 'p1', plantationName: 'Norte', pull: { estado: 'eliminada' } },
      { ...base, plantationId: 'p2', plantationName: 'Sur', pull: { estado: 'ok' } },
      { ...base, plantationId: 'p3', plantationName: 'Este', pull: { estado: 'sin-acceso' } },
      { ...base, plantationId: 'p4', plantationName: 'Oeste', pull: { estado: 'eliminada' } },
    ]);

    expect(omitidas).toEqual({ sinAcceso: ['Este'], eliminadas: ['Norte', 'Oeste'] });
    expect(hayOmitidas(omitidas)).toBe(true);
  });

  it('una plantación que falló antes de terminar el pull no cuenta como omitida', () => {
    const omitidas = plantacionesOmitidas([
      { ...base, plantationId: 'p1', plantationName: 'Norte', fallo: new Error('red') },
    ]);

    expect(hayOmitidas(omitidas)).toBe(false);
  });
});
