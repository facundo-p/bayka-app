import type { ScopeContextual } from '../../../hooks/useCommandMenu';
import { accionesRapidas, filtrarAcciones } from '../accionesRapidas';

const SCOPE: ScopeContextual = { plantationId: 'plant-1', etiqueta: 'La Maluka' };

test('sin scope: las 4 acciones base, sin ir a Configuración', () => {
  const acciones = accionesRapidas(null);
  expect(acciones.map((accion) => accion.id)).toEqual([
    'nueva-plantacion',
    'ir-plantaciones',
    'ir-especies',
    'ir-usuarios',
  ]);
});

test('con scope: suma "Ir a Configuración…" apuntando a la plantación del scope', () => {
  const acciones = accionesRapidas(SCOPE);
  const configuracion = acciones.find((accion) => accion.id === 'ir-configuracion');
  expect(configuracion).toBeDefined();
  expect(configuracion?.to).toBe('/plantaciones/plant-1/configuracion');
  expect(acciones).toHaveLength(5);
});

test('filtrarAcciones con texto vacío devuelve todas las acciones sin cambios', () => {
  const acciones = accionesRapidas(null);
  expect(filtrarAcciones(acciones, '')).toEqual(acciones);
  expect(filtrarAcciones(acciones, '   ')).toEqual(acciones);
});

test('filtrarAcciones filtra por substring del título, sin distinguir mayúsculas', () => {
  const acciones = accionesRapidas(null);
  const filtradas = filtrarAcciones(acciones, 'especies');
  expect(filtradas.map((accion) => accion.id)).toEqual(['ir-especies']);
});

test('filtrarAcciones sin coincidencias devuelve una lista vacía', () => {
  const acciones = accionesRapidas(null);
  expect(filtrarAcciones(acciones, 'zzz-no-existe')).toEqual([]);
});
