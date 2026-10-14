/**
 * Filtro del listado de especies científicas (#753). Puro: se testea sin renderizar.
 */
import { formatearEntero, pluralizar } from '../../lib/formato';
import { coincideBusqueda } from '../../lib/normalizarTexto';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';

export const AGRUPA_FILTRO = {
  todas: 'todas',
  conEspecies: 'con-especies',
  sinEspecies: 'sin-especies',
} as const;

export type AgrupaFiltro = (typeof AGRUPA_FILTRO)[keyof typeof AGRUPA_FILTRO];

export type FiltrosCientificas = {
  busqueda: string;
  agrupa: AgrupaFiltro;
};

/** Los filtros de la barra, sin el texto del buscador. */
export type FiltrosBarraCientificas = Omit<FiltrosCientificas, 'busqueda'>;

export const FILTROS_INICIALES_CIENTIFICAS: FiltrosBarraCientificas = {
  agrupa: AGRUPA_FILTRO.todas,
};

/** Una especie científica que no agrupa ninguna especie: la única que se puede eliminar. */
export function sinEspecies(cientifica: EspecieCientificaConEspecies): boolean {
  return cientifica.especies.length === 0;
}

/** Por su nombre o por el nombre o el código de las especies que agrupa. */
function coincide(cientifica: EspecieCientificaConEspecies, termino: string): boolean {
  const deEspecies = cientifica.especies.flatMap((especie) => [especie.nombre, especie.codigo]);
  return coincideBusqueda([cientifica.nombre, ...deEspecies], termino);
}

function pasaAgrupa(cientifica: EspecieCientificaConEspecies, agrupa: AgrupaFiltro): boolean {
  if (agrupa === AGRUPA_FILTRO.conEspecies) return !sinEspecies(cientifica);
  if (agrupa === AGRUPA_FILTRO.sinEspecies) return sinEspecies(cientifica);
  return true;
}

/** Conserva el orden de la consulta, por nombre. */
export function filtrarCientificas(
  cientificas: EspecieCientificaConEspecies[],
  { busqueda, agrupa }: FiltrosCientificas,
): EspecieCientificaConEspecies[] {
  return cientificas.filter(
    (cientifica) => coincide(cientifica, busqueda) && pasaAgrupa(cientifica, agrupa),
  );
}

/** Cuántas especies agrupan entre todas. */
export function contarEspeciesAgrupadas(cientificas: EspecieCientificaConEspecies[]): number {
  return cientificas.reduce((total, cientifica) => total + cientifica.especies.length, 0);
}

/** Meta de la cabecera: tamaño del catálogo y cuántas agrupan alguna especie. */
export function metaCientificas(cientificas: EspecieCientificaConEspecies[]): string {
  const conEspecies = cientificas.filter((cientifica) => !sinEspecies(cientifica)).length;
  const total = pluralizar(cientificas.length, SUSTANTIVO.especieCientifica);
  return `Catálogo global · ${total} · ${formatearEntero(conEspecies)} con especies`;
}
