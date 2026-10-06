import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  Select,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import { SUSTANTIVO } from '../../lib/sustantivos';
import { ETIQUETA_SUBTIPO_ESPECIE } from '../../lib/tiposEspecie';
import { SUBTIPO_ESPECIE } from '../../../../shared/tiposEspecie';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import {
  contarArboles,
  ORDEN_ESPECIE,
  SUBTIPO_FILTRO,
  USO_ESPECIE,
  type FiltrosBarraEspecies,
  type OrdenEspecie,
  type SubtipoFiltro,
  type UsoEspecie,
} from './filtros';

const OPCIONES_USO: Array<Opcion<UsoEspecie>> = [
  { value: USO_ESPECIE.todas, label: 'Todas' },
  { value: USO_ESPECIE.enUso, label: 'En uso' },
  { value: USO_ESPECIE.sinUso, label: 'Sin uso' },
];

const OPCIONES_SUBTIPO: Array<Opcion<SubtipoFiltro>> = [
  { value: SUBTIPO_FILTRO.todos, label: 'Subtipo: todos' },
  ...Object.values(SUBTIPO_ESPECIE).map((subtipo) => ({
    value: subtipo,
    label: `Subtipo: ${ETIQUETA_SUBTIPO_ESPECIE[subtipo].toLowerCase()}`,
  })),
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

/** Toolbar de Especies: búsqueda, filtros de uso y subtipo, orden y recuento, un renglón. */
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
      tituloFiltros="Filtros de especies"
      filtrosActivos={controles.activos}
      onLimpiar={controles.limpiar}
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} sustantivo={SUSTANTIVO.especie} /> ·{' '}
          <RecuentoItem cantidad={contarArboles(visibles)} sustantivo={SUSTANTIVO.arbol} />
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
        label="Filtrar por subtipo"
        labelOculto
        value={filtros.subtipo}
        onChange={(evento) => onFiltro('subtipo', evento.target.value as SubtipoFiltro)}
        opciones={OPCIONES_SUBTIPO}
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
