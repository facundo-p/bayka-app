// Matriz de gating de la botonera: required × permiso × servicios (issue #102).

import { getGpsGateState, GPS_GATE_MESSAGES } from '../../src/services/gps/gateRules';

describe('getGpsGateState', () => {
  it('captura NO obligatoria: siempre habilitada (degradación silenciosa)', () => {
    expect(getGpsGateState(false, 'denegado', false)).toBe('habilitada');
    expect(getGpsGateState(false, 'pendiente', null)).toBe('habilitada');
    expect(getGpsGateState(false, 'otorgado', true)).toBe('habilitada');
  });

  it('obligatoria + permiso denegado o pendiente: bloqueada por permiso', () => {
    expect(getGpsGateState(true, 'denegado', true)).toBe('bloqueada-permiso');
    expect(getGpsGateState(true, 'pendiente', true)).toBe('bloqueada-permiso');
    // El permiso gatea primero aunque el GPS también esté apagado.
    expect(getGpsGateState(true, 'denegado', false)).toBe('bloqueada-permiso');
  });

  it('obligatoria + permiso otorgado + GPS apagado: bloqueada por servicios', () => {
    expect(getGpsGateState(true, 'otorgado', false)).toBe('bloqueada-gps-apagado');
  });

  it('obligatoria + permiso otorgado + servicios ok (o sin chequear aún): habilitada', () => {
    expect(getGpsGateState(true, 'otorgado', true)).toBe('habilitada');
    expect(getGpsGateState(true, 'otorgado', null)).toBe('habilitada');
  });

  it('cada estado bloqueado tiene mensaje para el usuario', () => {
    expect(GPS_GATE_MESSAGES['bloqueada-permiso']).toMatch(/permiso/);
    expect(GPS_GATE_MESSAGES['bloqueada-gps-apagado']).toMatch(/ubicación/);
  });
});
