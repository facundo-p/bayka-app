import { useMemo } from 'react';
import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  Select,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import {
  contarArboles,
  FILTRO_ESTADO,
  ORDEN_PLANTACION,
  TEMPORADA_TODAS,
  temporadasDisponibles,
  type FiltroEstado,
  type FiltrosBarraPlantaciones,
  type OrdenPlantacion,
} from './filtros';

const OPCIONES_ESTADO: Array<Opcion<FiltroEstado>> = [
  { value: FILTRO_ESTADO.todas, label: 'Todas' },
  { value: FILTRO_ESTADO.activas, label: 'Activas' },
  { value: FILTRO_ESTADO.finalizadas, label: 'Finalizadas' },
];

const OPCIONES_ORDEN: Array<Opcion<OrdenPlantacion>> = [
  { value: ORDEN_PLANTACION.arboles, label: 'Orden: árboles ↓' },
  { value: ORDEN_PLANTACION.lugar, label: 'Orden: lugar A-Z' },
  { value: ORDEN_PLANTACION.creada, label: 'Orden: creada ↓' },
];

function opcionesTemporada(temporadas: string[]): Array<Opcion<string>> {
  return temporadas.map((temporada) => ({ value: temporada, label: temporada }));
}

interface PlantacionesToolbarProps {
  controles: ControlesFiltros<FiltrosBarraPlantaciones>;
  /** El listado completo: de él salen las temporadas del Select. */
  todas: PlantacionConStats[] | undefined;
  /** Las que pasan los filtros: de ellas sale el recuento. */
  visibles: PlantacionConStats[];
}

/** Toolbar de Plantaciones: búsqueda, estado, temporada, orden y recuento. */
export function PlantacionesToolbar({ controles, todas, visibles }: PlantacionesToolbarProps) {
  const { busqueda, onBuscar, filtros, onFiltro } = controles;
  const temporadas = useMemo(() => temporadasDisponibles(todas ?? []), [todas]);
  return (
    <BarraHerramientas
      encabezado={
        <CampoBusqueda
          label="Buscar plantaciones"
          placeholder="Buscar por lugar o temporada…"
          value={busqueda}
          onChange={onBuscar}
        />
      }
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} singular="plantación" plural="plantaciones" /> ·{' '}
          <RecuentoItem cantidad={contarArboles(visibles)} singular="árbol" plural="árboles" />
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_ESTADO}
        value={filtros.estado}
        onChange={(estado) => onFiltro('estado', estado)}
        size="sm"
        aria-label="Filtrar por estado"
      />
      {/* Filtrar por una única temporada no aporta ninguna decisión. */}
      {temporadas.length > 1 && (
        <Select
          label="Filtrar por temporada"
          labelOculto
          value={filtros.temporada}
          onChange={(evento) => onFiltro('temporada', evento.target.value)}
          opciones={opcionesTemporada(temporadas)}
        >
          <option value={TEMPORADA_TODAS}>Temporada: todas</option>
        </Select>
      )}
      <Select
        label="Ordenar plantaciones"
        labelOculto
        value={filtros.orden}
        onChange={(evento) => onFiltro('orden', evento.target.value as OrdenPlantacion)}
        opciones={OPCIONES_ORDEN}
      />
    </BarraHerramientas>
  );
}
