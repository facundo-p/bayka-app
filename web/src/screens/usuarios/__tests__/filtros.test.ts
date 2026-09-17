import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { ROL, type Rol } from '../../../repositories/profileRepository';
import {
  calcularMeta,
  contarActivas,
  FILTRO_ESTADO,
  FILTRO_ROL,
  filtrarUsuarios,
  resumenPlantaciones,
  type FiltrosUsuarios,
} from '../filtros';

function usuario(
  id: string,
  nombre: string,
  rol: Rol,
  email: string | null,
  activo: boolean,
  plantacionesAsignadas = 0,
): UsuarioConAsignaciones {
  return {
    id,
    nombre,
    rol,
    email,
    activo,
    organizacionId: 'org-1',
    organizacionNombre: 'Bayka',
    plantacionesAsignadas,
    createdAt: '2025-04-18T12:00:00Z',
  };
}

const EQUIPO = [
  usuario('u1', 'Sofía Súper', ROL.SUPERADMIN, 'sofia@bayka.app', true),
  usuario('u2', 'Ana Quiroga', ROL.ADMIN, 'ana.quiroga@bayka.app', true),
  usuario('u3', 'Lucía Ferreyra', ROL.TECNICO, 'lucia@gmail.com', true, 4),
  usuario('u4', 'Tomás Aguirre', ROL.TECNICO, null, false),
];

const BASE: FiltrosUsuarios = {
  busqueda: '',
  rol: FILTRO_ROL.todos,
  estado: FILTRO_ESTADO.todos,
};

function ids(filtros: Partial<FiltrosUsuarios>): string[] {
  return filtrarUsuarios(EQUIPO, { ...BASE, ...filtros }).map((u) => u.id);
}

test('la búsqueda matchea nombre y email, sin distinguir mayúsculas', () => {
  expect(ids({ busqueda: 'lucía' })).toEqual(['u3']);
  expect(ids({ busqueda: 'BAYKA.APP' })).toEqual(['u1', 'u2']);
  // Un perfil sin email no rompe la comparación.
  expect(ids({ busqueda: 'aguirre' })).toEqual(['u4']);
  expect(ids({ busqueda: '  ' })).toHaveLength(4);
});

test('"Admins" agrupa admin y superadmin; "Técnicos" solo técnicos', () => {
  expect(ids({ rol: FILTRO_ROL.admins })).toEqual(['u1', 'u2']);
  expect(ids({ rol: FILTRO_ROL.tecnicos })).toEqual(['u3', 'u4']);
});

test('el filtro de estado parte por activo/inactivo', () => {
  expect(ids({ estado: FILTRO_ESTADO.activos })).toEqual(['u1', 'u2', 'u3']);
  expect(ids({ estado: FILTRO_ESTADO.inactivos })).toEqual(['u4']);
});

test('los tres filtros componen entre sí', () => {
  expect(ids({ rol: FILTRO_ROL.tecnicos, estado: FILTRO_ESTADO.activos })).toEqual(['u3']);
  // Admins inactivos: no hay ninguno.
  expect(ids({ rol: FILTRO_ROL.admins, estado: FILTRO_ESTADO.inactivos })).toEqual([]);
  expect(ids({ busqueda: 'a', rol: FILTRO_ROL.tecnicos, estado: FILTRO_ESTADO.inactivos })).toEqual(
    ['u4'],
  );
});

test('los roles de gestión acceden a todas las plantaciones (#67)', () => {
  expect(resumenPlantaciones(EQUIPO[0])).toBe('Todas');
  expect(resumenPlantaciones(EQUIPO[1])).toBe('Todas');
  expect(resumenPlantaciones(EQUIPO[2])).toBe('4 plantaciones');
  expect(resumenPlantaciones(EQUIPO[3])).toBe('Sin plantaciones');
});

test.each([
  [1, '1 plantación'],
  [2, '2 plantaciones'],
  [1000, '1.000 plantaciones'],
])('el resumen de un técnico con %i asignaciones: "%s"', (asignadas, texto) => {
  expect(resumenPlantaciones(usuario('u9', 'Uno', ROL.TECNICO, null, true, asignadas))).toBe(texto);
});

test('la meta de la cabecera cuenta por rol y pluraliza', () => {
  expect(calcularMeta(EQUIPO)).toBe('4 personas · 1 superadmin · 1 admin · 2 técnicos');
  expect(calcularMeta([EQUIPO[0]])).toBe('1 persona · 1 superadmin · 0 admins · 0 técnicos');
  expect(contarActivas(EQUIPO)).toBe(3);
});

test('la meta también pluraliza los superadmins', () => {
  const dosSuper = [EQUIPO[0], { ...EQUIPO[0], id: 'u8' }];
  expect(calcularMeta(dosSuper)).toBe('2 personas · 2 superadmins · 0 admins · 0 técnicos');
  expect(calcularMeta([])).toBe('0 personas · 0 superadmins · 0 admins · 0 técnicos');
});
