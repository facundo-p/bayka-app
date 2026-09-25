/** Qué rechazo deja lo pendiente varado y cuál se reintenta (#638). */
import { motivoVarado } from '../../src/services/sync/pendientesVarados';

jest.mock('../../src/database/client', () => ({ db: {} }));
jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

describe('motivoVarado', () => {
  it.each([
    ['PLANTACION_FINALIZADA', 'finalizada'],
    ['PLANTACION_ARCHIVADA', 'archivada'],
    ['PERMISSION', 'sin-permiso'],
    ['SIN_PERMISO_CREAR', 'sin-permiso'],
    ['NOT_AUTHORIZED', 'sin-permiso'],
  ])('%s es permanente: %s', (codigo, motivo) => {
    expect(motivoVarado(codigo)).toBe(motivo);
  });

  it.each(['NETWORK', 'TIMEOUT', 'UNKNOWN', 'DUPLICATE_CODE', 'PARCELA_PENDING', 'PLANTACION_INEXISTENTE', '', null, undefined])(
    '%s se reintenta',
    (codigo) => {
      expect(motivoVarado(codigo as string | null | undefined)).toBeNull();
    },
  );
});
