import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  Select,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import {
  contarArboles,
  ORDEN_ESPECIE,
  USO_ESPECIE,
  type FiltrosBarraEspecies,
  type OrdenEspecie,
  type UsoEspecie,
} from './filtros';

const OPCIONES_USO: Array<Opcion<UsoEspecie>> = [
  { value: USO_ESPECIE.todas, label: 'Todas' },
  { value: USO_ESPECIE.enUso, label: 'En uso' },
  { value: USO_ESPECIE.sinUso, label: 'Sin uso' },
];

const OPCIONES_ORDEN: Array<Opcion<OrdenEspecie>> = [
  { value: ORDEN_ESPECIE.arboles, label: 'Orden: árboles ↓' },
  { value: ORDEN_ESPECIE.plantaciones, label: 'Orden: plantaciones ↓' },
  { value: ORDEN_ESPECIE.codigo, label: 'Orden: código A-Z' },
];

interface EspeciesToolbarProps {
  controles: ControlesFiltros<FiltrosBarraEspecies>;
  /** Las que pasan los filtros: de ellas sale el recuento. */
  visibles: EspecieConCatalogoUso[];
}

/** Toolbar de Especies: búsqueda, filtro de uso, orden y recuento, un renglón. */
export function EspeciesToolbar({ controles, visibles }: EspeciesToolbarProps) {
  const { busqueda, onBuscar, filtros, onFiltro } = controles;
  return (
    <BarraHerramientas
      encabezado={
        <CampoBusqueda
          label="Buscar especies"
          placeholder="Buscar por nombre, código o científico…"
          value={busqueda}
          onChange={onBuscar}
        />
      }
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} singular="especie" plural="especies" /> ·{' '}
          <RecuentoItem cantidad={contarArboles(visibles)} singular="árbol" plural="árboles" />
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_USO}
        value={filtros.uso}
        onChange={(uso) => onFiltro('uso', uso)}
        size="sm"
        aria-label="Filtrar por uso"
      />
      <Select
        label="Ordenar especies"
        labelOculto
        value={filtros.orden}
        onChange={(evento) => onFiltro('orden', evento.target.value as OrdenEspecie)}
        opciones={OPCIONES_ORDEN}
      />
    </BarraHerramientas>
  );
}
