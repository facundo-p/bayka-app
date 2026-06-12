// Matriz de gating de la botonera: required × medición × permiso × servicios
// (issues #102 / #121).

import { getGpsGateState, GPS_GATE_MESSAGES } from '../../src/services/gps/gateRules';

describe('getGpsGateState', () => {
  it('captura NO obligatoria: siempre habilitada (degradación silenciosa)', () => {
    expect(getGpsGateState(false, true, 'denegado', false)).toBe('habilitada');
    expect(getGpsGateState(false, false, 'pendiente', null)).toBe('habilitada');
    expect(getGpsGateState(false, true, 'otorgado', true)).toBe('habilitada');
  });

  it('obligatoria + medición desactivada: bloqueada por medición (precede a todo)', () => {
    expect(getGpsGateState(true, false, 'otorgado', true)).toBe('bloqueada-medicion-off');
    // El toggle gatea primero, aunque permiso y servicios también fallen.
    expect(getGpsGateState(true, false, 'denegado', false)).toBe('bloqueada-medicion-off');
  });

  it('obligatoria + medición ON + permiso denegado o pendiente: bloqueada por permiso', () => {
    expect(getGpsGateState(true, true, 'denegado', true)).toBe('bloqueada-permiso');
    expect(getGpsGateState(true, true, 'pendiente', true)).toBe('bloqueada-permiso');
    expect(getGpsGateState(true, true, 'denegado', false)).toBe('bloqueada-permiso');
  });

  it('obligatoria + medición ON + permiso otorgado + GPS apagado: bloqueada por servicios', () => {
    expect(getGpsGateState(true, true, 'otorgado', false)).toBe('bloqueada-gps-apagado');
  });

  it('obligatoria + medición ON + permiso otorgado + servicios ok (o sin chequear): habilitada', () => {
    expect(getGpsGateState(true, true, 'otorgado', true)).toBe('habilitada');
    expect(getGpsGateState(true, true, 'otorgado', null)).toBe('habilitada');
  });

  it('cada estado bloqueado tiene mensaje para el usuario', () => {
    expect(GPS_GATE_MESSAGES['bloqueada-medicion-off']).toMatch(/medición/);
    expect(GPS_GATE_MESSAGES['bloqueada-permiso']).toMatch(/permiso/);
    expect(GPS_GATE_MESSAGES['bloqueada-gps-apagado']).toMatch(/ubicación/);
  });
});
