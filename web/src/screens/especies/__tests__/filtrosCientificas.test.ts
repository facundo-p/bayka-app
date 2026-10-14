import type { EspecieCientificaConEspecies } from '../../../queries/especieCientificaQueries';
import {
  AGRUPA_FILTRO,
  contarEspeciesAgrupadas,
  filtrarCientificas,
  metaCientificas,
  sinEspecies,
  type FiltrosCientificas,
} from '../filtrosCientificas';

function cientifica(
  nombre: string,
  ...especies: Array<[string, string]>
): EspecieCientificaConEspecies {
  return {
    id: nombre,
    nombre,
    especies: especies.map(([codigo, nombreComun]) => ({
      id: codigo,
      codigo,
      nombre: nombreComun,
    })),
  };
}

const LISTA = [
  cientifica('Prosopis alba', ['ALB', 'Algarrobo blanco'], ['IGA', 'Igarobá']),
  cientifica('Schinus molle', ['MOL', 'Molle']),
  cientifica('Celtis tala'),
];

const BASE: FiltrosCientificas = { busqueda: '', agrupa: AGRUPA_FILTRO.todas };

function nombres(filtros: Partial<FiltrosCientificas>): string[] {
  return filtrarCientificas(LISTA, { ...BASE, ...filtros }).map((c) => c.nombre);
}

test('sinEspecies: solo la que no agrupa ninguna', () => {
  expect(LISTA.map(sinEspecies)).toEqual([false, false, true]);
});

test('la búsqueda matchea el nombre científico y el nombre o código de sus especies', () => {
  expect(nombres({ busqueda: 'prosopis' })).toEqual(['Prosopis alba']);
  expect(nombres({ busqueda: 'igaroba' })).toEqual(['Prosopis alba']);
  expect(nombres({ busqueda: 'mol' })).toEqual(['Schinus molle']);
});

test('el filtro parte entre las que agrupan especies y las que no', () => {
  expect(nombres({ agrupa: AGRUPA_FILTRO.conEspecies })).toEqual([
    'Prosopis alba',
    'Schinus molle',
  ]);
  expect(nombres({ agrupa: AGRUPA_FILTRO.sinEspecies })).toEqual(['Celtis tala']);
});

test('recuento de especies agrupadas y meta de la cabecera', () => {
  expect(contarEspeciesAgrupadas(LISTA)).toBe(3);
  expect(metaCientificas(LISTA)).toBe('Catálogo global · 3 especies científicas · 2 con especies');
});
