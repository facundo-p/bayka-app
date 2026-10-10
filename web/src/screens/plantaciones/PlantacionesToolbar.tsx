import { useEffect, useMemo } from 'react';
import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  Select,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import { usePerfiles } from '../../hooks/usePerfiles';
import { nombreVisible } from '../../lib/presentacionUsuario';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import {
  contarArboles,
  FILTRO_ESTADO,
  FILTRO_VISIBLES,
  ORDEN_PLANTACION,
  TECNICO_TODOS,
  tecnicoElegible,
  tecnicosAsignados,
  TEMPORADA_TODAS,
  temporadasDisponibles,
  type FiltroEstado,
  type FiltrosBarraPlantaciones,
  type FiltroVisibles,
  type OrdenPlantacion,
} from './filtros';

const OPCIONES_ESTADO: Array<Opcion<FiltroEstado>> = [
  { value: FILTRO_ESTADO.todas, label: 'Todas' },
  { value: FILTRO_ESTADO.activas, label: 'Activas' },
  { value: FILTRO_ESTADO.finalizadas, label: 'Finalizadas' },
  { value: FILTRO_ESTADO.archivadas, label: 'Archivadas' },
];

const OPCIONES_ORDEN: Array<Opcion<OrdenPlantacion>> = [
  { value: ORDEN_PLANTACION.arboles, label: 'Orden: árboles ↓' },
  { value: ORDEN_PLANTACION.lugar, label: 'Orden: lugar A-Z' },
  { value: ORDEN_PLANTACION.creada, label: 'Orden: creada ↓' },
];

const OPCIONES_VISIBLES: Array<Opcion<FiltroVisibles>> = [
  { value: FILTRO_VISIBLES.todas, label: 'Visibles: todas' },
  { value: FILTRO_VISIBLES.si, label: 'Visibles: sí' },
  { value: FILTRO_VISIBLES.no, label: 'Visibles: no' },
];

function opcionesTemporada(temporadas: string[]): Array<Opcion<string>> {
  return temporadas.map((temporada) => ({ value: temporada, label: temporada }));
}

/** Técnicos que se pueden elegir en «Visible por»: los activos con alguna asignación.
 *  `listas` es falso mientras falten los perfiles o las plantaciones. */
function useOpcionesTecnico(todas: PlantacionConStats[] | undefined) {
  const perfiles = usePerfiles();
  const opciones = useMemo(
    () =>
      tecnicosAsignados(perfiles.data ?? [], todas ?? []).map((perfil) => ({
        value: perfil.id,
        label: nombreVisible(perfil.nombre, perfil.id),
      })),
    [perfiles.data, todas],
  );
  return { opciones, listas: perfiles.isSuccess && todas !== undefined };
}

/** Si el técnico elegido sale de las opciones, el Select mostraría «todos» con el filtro
 *  aplicado: se suelta. Vive en la barra y no en la hoja, que en teléfono se desmonta. */
function useSoltarTecnicoAusente(
  controles: ControlesFiltros<FiltrosBarraPlantaciones>,
  todas: PlantacionConStats[] | undefined,
): Array<Opcion<string>> {
  const { opciones, listas } = useOpcionesTecnico(todas);
  const { filtros, onFiltro } = controles;
  useEffect(() => {
    const elegibles = opciones.map((opcion) => opcion.value);
    if (listas && !tecnicoElegible(filtros.visiblePor, elegibles)) {
      onFiltro('visiblePor', TECNICO_TODOS);
    }
  }, [listas, opciones, filtros.visiblePor, onFiltro]);
  return opciones;
}

interface FiltrosVisibilidadProps {
  controles: ControlesFiltros<FiltrosBarraPlantaciones>;
  tecnicos: Array<Opcion<string>>;
}

/** «Visible por» (técnico asignado) y «Visibles» (en la app): juntos dicen qué ve un técnico. */
function FiltrosVisibilidad({ controles, tecnicos }: FiltrosVisibilidadProps) {
  const { filtros, onFiltro } = controles;
  return (
    <>
      <Select
        label="Filtrar por técnico asignado"
        labelOculto
        value={filtros.visiblePor}
        onChange={(evento) => onFiltro('visiblePor', evento.target.value)}
        opciones={tecnicos}
      >
        <option value={TECNICO_TODOS}>Visible por: todos</option>
      </Select>
      <Select
        label="Filtrar por visibilidad en la app"
        labelOculto
        value={filtros.visibles}
        onChange={(evento) => onFiltro('visibles', evento.target.value as FiltroVisibles)}
        opciones={OPCIONES_VISIBLES}
      />
    </>
  );
}

interface PlantacionesToolbarProps {
  controles: ControlesFiltros<FiltrosBarraPlantaciones>;
  /** El listado completo: de él salen las temporadas del Select. */
  todas: PlantacionConStats[] | undefined;
  /** Las que pasan los filtros: de ellas sale el recuento. */
  visibles: PlantacionConStats[];
}

/** Toolbar de Plantaciones: búsqueda, estado, temporada, visibilidad, orden y recuento. */
export function PlantacionesToolbar({ controles, todas, visibles }: PlantacionesToolbarProps) {
  const { busqueda, onBuscar, filtros, onFiltro } = controles;
  const temporadas = useMemo(() => temporadasDisponibles(todas ?? []), [todas]);
  const tecnicos = useSoltarTecnicoAusente(controles, todas);
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
      tituloFiltros="Filtros de plantaciones"
      filtrosActivos={controles.activos}
      onLimpiar={controles.limpiar}
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} sustantivo={SUSTANTIVO.plantacion} /> ·{' '}
          <RecuentoItem cantidad={contarArboles(visibles)} sustantivo={SUSTANTIVO.arbol} />
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
      <FiltrosVisibilidad controles={controles} tecnicos={tecnicos} />
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
