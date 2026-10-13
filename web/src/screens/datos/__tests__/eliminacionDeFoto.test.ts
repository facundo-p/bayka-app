import { descripcionEliminarFoto, motivoParaNoEliminarFoto } from '../eliminacionDeFoto';

const ACTIVA = { estado: 'activa', archivadaEn: null } as const;
const FINALIZADA = { estado: 'finalizada', archivadaEn: null } as const;
const ARCHIVADA = { estado: 'finalizada', archivadaEn: '2026-09-01T00:00:00Z' } as const;

const ADMIN = { rol: 'admin', activo: true } as const;
const SUPERADMIN = { rol: 'superadmin', activo: true } as const;
const TECNICO = { rol: 'tecnico', activo: true } as const;

const SIN_PERMISO = 'Tu usuario no tiene permisos para eliminar fotos.';
const ARCHIVADA_MOTIVO = 'La plantación está archivada: desarchivala para eliminar la foto.';

describe('motivoParaNoEliminarFoto', () => {
  test.each([
    ['admin en una activa', ADMIN, ACTIVA, null],
    ['admin en una finalizada', ADMIN, FINALIZADA, null],
    ['superadmin en una finalizada', SUPERADMIN, FINALIZADA, null],
    ['admin en una archivada', ADMIN, ARCHIVADA, ARCHIVADA_MOTIVO],
    ['superadmin en una archivada', SUPERADMIN, ARCHIVADA, ARCHIVADA_MOTIVO],
    ['técnico en una activa', TECNICO, ACTIVA, SIN_PERMISO],
    ['admin inactivo', { ...ADMIN, activo: false }, ACTIVA, SIN_PERMISO],
  ])('%s', (_caso, perfil, plantacion, esperado) => {
    expect(motivoParaNoEliminarFoto(perfil, plantacion)).toBe(esperado);
  });

  test('sin perfil no tiene permiso; sin plantación cargada, espera', () => {
    expect(motivoParaNoEliminarFoto(null, ACTIVA)).toBe(SIN_PERMISO);
    expect(motivoParaNoEliminarFoto(ADMIN, undefined)).toBe('Cargando la plantación…');
  });
});

test('la descripción dice qué árbol y que es para todos', () => {
  expect(descripcionEliminarFoto('A-001-SS26')).toMatch(/árbol A-001-SS26 para todos/);
});
