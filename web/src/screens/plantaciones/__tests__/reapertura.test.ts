import { reabrirPlantacion } from '../../../repositories/plantationRepository';
import { CONFIRMACION_REAPERTURA, esReabrible, puedeReabrir } from '../reapertura';

vi.mock('../../../repositories/plantationRepository', () => ({
  reabrirPlantacion: vi.fn(),
}));

const FINALIZADA = { estado: 'finalizada', archivadaEn: null } as const;
const ACTIVA = { estado: 'activa', archivadaEn: null } as const;
const FINALIZADA_ARCHIVADA = { estado: 'finalizada', archivadaEn: '2026-09-01T12:00:00Z' } as const;

describe('puedeReabrir', () => {
  test.each([
    ['superadmin activo', { rol: 'superadmin', activo: true }, true],
    ['admin activo', { rol: 'admin', activo: true }, false],
    ['técnico', { rol: 'tecnico', activo: true }, false],
    ['superadmin inactivo', { rol: 'superadmin', activo: false }, false],
  ] as const)('%s → %s', (_caso, perfil, esperado) => {
    expect(puedeReabrir(perfil)).toBe(esperado);
  });

  test('sin perfil no puede', () => {
    expect(puedeReabrir(null)).toBe(false);
  });
});

describe('esReabrible', () => {
  test('solo una finalizada', () => {
    expect(esReabrible(FINALIZADA)).toBe(true);
    expect(esReabrible(ACTIVA)).toBe(false);
  });

  test('una archivada no: desarchivarla es otra decisión', () => {
    expect(esReabrible(FINALIZADA_ARCHIVADA)).toBe(false);
  });
});

test('la confirmación nombra la plantación y aclara qué NO se deshace', () => {
  expect(CONFIRMACION_REAPERTURA.titulo('El Ceibal')).toContain('El Ceibal');
  expect(CONFIRMACION_REAPERTURA.descripcion('El Ceibal')).toContain('El Ceibal');
  expect(CONFIRMACION_REAPERTURA.aviso).toContain('grupos ya finalizados');
});

test('confirmar llama al RPC con el id', async () => {
  await CONFIRMACION_REAPERTURA.servicio('plant-1');

  expect(reabrirPlantacion).toHaveBeenCalledWith('plant-1');
});
