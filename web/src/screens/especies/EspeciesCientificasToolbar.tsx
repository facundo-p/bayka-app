import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import {
  AGRUPA_FILTRO,
  contarEspeciesAgrupadas,
  type AgrupaFiltro,
  type FiltrosBarraCientificas,
} from './filtrosCientificas';

const OPCIONES_AGRUPA: Array<Opcion<AgrupaFiltro>> = [
  { value: AGRUPA_FILTRO.todas, label: 'Todas' },
  { value: AGRUPA_FILTRO.conEspecies, label: 'Con especies' },
  { value: AGRUPA_FILTRO.sinEspecies, label: 'Sin especies' },
];

interface EspeciesCientificasToolbarProps {
  controles: ControlesFiltros<FiltrosBarraCientificas>;
  /** Las que pasan los filtros: de ellas sale el recuento. */
  visibles: EspecieCientificaConEspecies[];
}

/** Toolbar de especies científicas: búsqueda, filtro por si agrupan especies y recuento. */
export function EspeciesCientificasToolbar({
  controles,
  visibles,
}: EspeciesCientificasToolbarProps) {
  const { busqueda, onBuscar, filtros, onFiltro } = controles;
  return (
    <BarraHerramientas
      encabezado={
        <CampoBusqueda
          label="Buscar especies científicas"
          placeholder="Buscar por nombre o especie…"
          value={busqueda}
          onChange={onBuscar}
        />
      }
      tituloFiltros="Filtros de especies científicas"
      filtrosActivos={controles.activos}
      onLimpiar={controles.limpiar}
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} sustantivo={SUSTANTIVO.especieCientifica} /> ·{' '}
          <RecuentoItem
            cantidad={contarEspeciesAgrupadas(visibles)}
            sustantivo={SUSTANTIVO.especie}
          />
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_AGRUPA}
        value={filtros.agrupa}
        onChange={(agrupa) => onFiltro('agrupa', agrupa)}
        size="sm"
        aria-label="Filtrar por especies agrupadas"
      />
    </BarraHerramientas>
  );
}
