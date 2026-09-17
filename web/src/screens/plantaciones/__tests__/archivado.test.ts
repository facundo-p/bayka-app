import {
  archivarPlantacion,
  desarchivarPlantacion,
} from '../../../repositories/plantationRepository';
import {
  accionDeArchivado,
  CONFIRMACION_ARCHIVADO,
  motivoEdicion,
  puedeArchivar,
} from '../archivado';

vi.mock('../../../repositories/plantationRepository', () => ({
  archivarPlantacion: vi.fn(),
  desarchivarPlantacion: vi.fn(),
}));

const ACTIVA = { archivadaEn: null };
const ARCHIVADA = { archivadaEn: '2026-09-01T12:00:00Z' };

describe('puedeArchivar', () => {
  test.each([
    ['admin activo', { rol: 'admin', activo: true }, true],
    ['superadmin activo', { rol: 'superadmin', activo: true }, true],
    ['técnico', { rol: 'tecnico', activo: true }, false],
    ['admin inactivo', { rol: 'admin', activo: false }, false],
  ] as const)('%s → %s', (_caso, perfil, esperado) => {
    expect(puedeArchivar(perfil)).toBe(esperado);
  });

  test('sin perfil no puede', () => {
    expect(puedeArchivar(null)).toBe(false);
  });
});

test('la acción depende de si está archivada', () => {
  expect(accionDeArchivado(ACTIVA)).toBe('archivar');
  expect(accionDeArchivado(ARCHIVADA)).toBe('desarchivar');
});

test('solo una archivada tiene motivo para no editar', () => {
  expect(motivoEdicion(ACTIVA)).toBeNull();
  expect(motivoEdicion(ARCHIVADA)).toMatch(/desarchivala/);
});

describe('confirmaciones', () => {
  test('archivar avisa qué se oculta, que es solo lectura, los pendientes y que es reversible', () => {
    const texto = CONFIRMACION_ARCHIVADO.archivar.descripcion('Mendoza');
    expect(texto).toMatch(/deja de aparecer en los listados de la web y en la app/);
    expect(texto).toMatch(/solo lectura/);
    expect(texto).toMatch(/no los va a poder subir hasta que se desarchive/);
    expect(texto).toMatch(/Se puede desarchivar/);
    expect(CONFIRMACION_ARCHIVADO.archivar.destructiva).toBe(true);
  });

  test('desarchivar aclara que el estado no cambia', () => {
    const texto = CONFIRMACION_ARCHIVADO.desarchivar.descripcion('Mendoza');
    expect(texto).toMatch(/no cambia/);
    expect(CONFIRMACION_ARCHIVADO.desarchivar.destructiva).toBeUndefined();
  });

  test('cada acción ejecuta su servicio', () => {
    expect(CONFIRMACION_ARCHIVADO.archivar.servicio).toBe(archivarPlantacion);
    expect(CONFIRMACION_ARCHIVADO.desarchivar.servicio).toBe(desarchivarPlantacion);
  });
});
