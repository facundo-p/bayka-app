import { arbolDetalle } from '../../../test/fabricas';
import {
  arbolConEspecie,
  especieElegida,
  opcionesDeEspecie,
  puedeCambiarEspecie,
} from '../cambioDeEspecie';

const ACTIVA = { estado: 'activa', archivadaEn: null } as const;
const FINALIZADA = { estado: 'finalizada', archivadaEn: null } as const;
const ARCHIVADA = { estado: 'activa', archivadaEn: '2026-09-01T00:00:00Z' } as const;

const ADMIN = { rol: 'admin', activo: true } as const;
const SUPERADMIN = { rol: 'superadmin', activo: true } as const;
const TECNICO = { rol: 'tecnico', activo: true } as const;

describe('puedeCambiarEspecie', () => {
  test.each([
    ['admin en una activa', ADMIN, ACTIVA, true],
    ['admin en una finalizada', ADMIN, FINALIZADA, false],
    ['superadmin en una finalizada', SUPERADMIN, FINALIZADA, true],
    ['superadmin en una archivada', SUPERADMIN, ARCHIVADA, false],
    ['admin en una archivada', ADMIN, ARCHIVADA, false],
    ['técnico en una activa', TECNICO, ACTIVA, false],
    ['admin inactivo', { ...ADMIN, activo: false }, ACTIVA, false],
  ])('%s → %s', (_caso, perfil, plantacion, esperado) => {
    expect(puedeCambiarEspecie(perfil, plantacion)).toBe(esperado);
  });

  test('sin perfil o sin plantación cargada, no', () => {
    expect(puedeCambiarEspecie(null, ACTIVA)).toBe(false);
    expect(puedeCambiarEspecie(ADMIN, undefined)).toBe(false);
  });
});

const ESPECIES = [
  { id: 'sp-1', codigo: 'CEI', nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli' },
  { id: 'sp-2', codigo: 'TAL', nombre: 'Tala', nombreCientifico: null },
];

test('las opciones muestran código y nombre, y el científico debajo', () => {
  expect(opcionesDeEspecie(ESPECIES)).toEqual([
    { valor: 'sp-1', principal: 'CEI · Ceibo', secundario: 'Erythrina crista-galli' },
    { valor: 'sp-2', principal: 'TAL · Tala', secundario: null },
  ]);
});

test('especieElegida toma código y nombres de la lista', () => {
  expect(especieElegida(ESPECIES, 'sp-1', 'P1L1CEI3')).toEqual({
    especieId: 'sp-1',
    especieCodigo: 'CEI',
    especieNombre: 'Ceibo',
    especieNombreCientifico: 'Erythrina crista-galli',
    subId: 'P1L1CEI3',
  });
  expect(especieElegida(undefined, 'sp-9', 'X')).toMatchObject({
    especieCodigo: null,
    especieNombre: null,
    especieNombreCientifico: null,
  });
});

test('arbolConEspecie rearma el ID del árbol con el SubID nuevo', () => {
  const arbol = arbolDetalle({ subId: 'P1L1CEI3', idArbol: 'P1L1CEI3-SS26', especieId: 'sp-1' });
  const cambiado = arbolConEspecie(
    arbol,
    {
      especieId: 'sp-2',
      especieCodigo: 'TAL',
      especieNombre: 'Tala',
      especieNombreCientifico: null,
      subId: 'P1L1TAL3',
    },
    'SS26',
  );
  expect(cambiado).toMatchObject({
    especieId: 'sp-2',
    especieCodigo: 'TAL',
    especieNombre: 'Tala',
    subId: 'P1L1TAL3',
    idArbol: 'P1L1TAL3-SS26',
  });
});
