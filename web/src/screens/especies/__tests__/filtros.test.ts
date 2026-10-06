import type { EspecieConCatalogoUso } from '../../../queries/especieQueries';
import {
  contarArboles,
  contarEnUso,
  filtrarEspecies,
  metaCatalogo,
  ORDEN_ESPECIE,
  sinUso,
  SUBTIPO_FILTRO,
  USO_ESPECIE,
  type FiltrosEspecies,
} from '../filtros';
import type { SubtipoEspecie } from '../../../../../shared/tiposEspecie';

function especie(
  codigo: string,
  nombre: string,
  plantaciones: number,
  arboles: number,
  nombreCientifico: string | null = null,
  subtipo: SubtipoEspecie = 'arbol',
): EspecieConCatalogoUso {
  return {
    id: codigo,
    codigo,
    nombre,
    nombreCientifico,
    tipo: 'flora',
    subtipo,
    plantaciones,
    arboles,
  };
}

const CATALOGO = [
  especie('ALG', 'Algarrobo blanco', 6, 3412, 'Prosopis alba'),
  especie('LAP', 'Lapacho rosado', 4, 1402, 'Handroanthus impetiginosus'),
  especie('MOL', 'Molle', 0, 0, 'Schinus molle', 'arbusto'),
  especie('TAL', 'Tala', 0, 0),
];

const BASE: FiltrosEspecies = {
  busqueda: '',
  uso: USO_ESPECIE.todas,
  subtipo: SUBTIPO_FILTRO.todos,
  orden: ORDEN_ESPECIE.codigo,
};

function codigos(filtros: Partial<FiltrosEspecies>): string[] {
  return filtrarEspecies(CATALOGO, { ...BASE, ...filtros }).map((e) => e.codigo);
}

test('sinUso exige cero plantaciones Y cero árboles', () => {
  expect(sinUso(especie('X', 'X', 0, 0))).toBe(true);
  expect(sinUso(especie('X', 'X', 0, 5))).toBe(false);
  expect(sinUso(especie('X', 'X', 1, 0))).toBe(false);
});

test('la búsqueda matchea nombre, código y científico, sin distinguir mayúsculas', () => {
  expect(codigos({ busqueda: 'lapacho' })).toEqual(['LAP']);
  expect(codigos({ busqueda: 'alg' })).toEqual(['ALG']);
  expect(codigos({ busqueda: 'Schinus' })).toEqual(['MOL']);
  expect(codigos({ busqueda: '   ' })).toHaveLength(4);
});

test('la búsqueda ignora tildes en el término y en el nombre (#438)', () => {
  const catalogo = [especie('TIM', 'Timbó', 1, 10), especie('CEI', 'Ceibo', 1, 10)];
  const buscar = (busqueda: string) =>
    filtrarEspecies(catalogo, { ...BASE, busqueda }).map((e) => e.codigo);
  expect(buscar('timbo')).toEqual(['TIM']);
  expect(buscar('TIMBÓ')).toEqual(['TIM']);
  expect(buscar('céibo')).toEqual(['CEI']);
});

test('el filtro de uso parte el catálogo en usadas y sin usar', () => {
  expect(codigos({ uso: USO_ESPECIE.enUso })).toEqual(['ALG', 'LAP']);
  expect(codigos({ uso: USO_ESPECIE.sinUso })).toEqual(['MOL', 'TAL']);
  expect(codigos({ uso: USO_ESPECIE.todas })).toHaveLength(4);
});

test('el orden por conteo va de mayor a menor y desempata por código', () => {
  expect(codigos({ orden: ORDEN_ESPECIE.arboles })).toEqual(['ALG', 'LAP', 'MOL', 'TAL']);
  expect(codigos({ orden: ORDEN_ESPECIE.plantaciones })).toEqual(['ALG', 'LAP', 'MOL', 'TAL']);
  // Empatadas en 0: el desempate por código las deja estables.
  expect(codigos({ orden: ORDEN_ESPECIE.arboles, uso: USO_ESPECIE.sinUso })).toEqual([
    'MOL',
    'TAL',
  ]);
});

test('el filtro de subtipo deja solo las especies de ese subtipo', () => {
  expect(codigos({ subtipo: SUBTIPO_FILTRO.arbusto })).toEqual(['MOL']);
  expect(codigos({ subtipo: SUBTIPO_FILTRO.arbol })).toEqual(['ALG', 'LAP', 'TAL']);
  expect(codigos({ subtipo: SUBTIPO_FILTRO.todos })).toHaveLength(4);
});

test('subtipo y uso componen entre sí', () => {
  expect(codigos({ subtipo: SUBTIPO_FILTRO.arbol, uso: USO_ESPECIE.sinUso })).toEqual(['TAL']);
});

test('búsqueda y uso componen entre sí', () => {
  expect(codigos({ busqueda: 'a', uso: USO_ESPECIE.sinUso })).toEqual(['TAL']);
});

test('los recuentos de la cabecera cuentan sobre el catálogo dado', () => {
  expect(contarEnUso(CATALOGO)).toBe(2);
  expect(contarArboles(CATALOGO)).toBe(4814);
});

test.each([
  [0, 'Catálogo global · 0 especies nativas · 0 en uso'],
  [1, 'Catálogo global · 1 especie nativa · 1 en uso'],
  [2, 'Catálogo global · 2 especies nativas · 2 en uso'],
  [1000, 'Catálogo global · 1.000 especies nativas · 1.000 en uso'],
])('la meta del catálogo con %i especies: "%s"', (cantidad, texto) => {
  const catalogo = Array.from({ length: cantidad }, (_, i) => especie(`E${i}`, 'E', 1, 1));
  expect(metaCatalogo(catalogo)).toBe(texto);
});
