import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import {
  contarActivas,
  FILTRO_ESTADO,
  FILTRO_ROL,
  type FiltroEstado,
  type FiltroRol,
  type FiltrosBarraUsuarios,
} from './filtros';

const OPCIONES_ROL: Array<Opcion<FiltroRol>> = [
  { value: FILTRO_ROL.todos, label: 'Rol: todos' },
  { value: FILTRO_ROL.admins, label: 'Admins' },
  { value: FILTRO_ROL.tecnicos, label: 'Técnicos' },
];

const OPCIONES_ESTADO: Array<Opcion<FiltroEstado>> = [
  { value: FILTRO_ESTADO.todos, label: 'Estado: todos' },
  { value: FILTRO_ESTADO.activos, label: 'Activos' },
  { value: FILTRO_ESTADO.inactivos, label: 'Inactivos' },
];

interface UsuariosToolbarProps {
  controles: ControlesFiltros<FiltrosBarraUsuarios>;
  /** Las personas que pasan los filtros: de ellas sale el recuento. */
  visibles: UsuarioConAsignaciones[];
}

/** Toolbar de Usuarios: búsqueda, rol, estado y recuento, un solo renglón. */
export function UsuariosToolbar({ controles, visibles }: UsuariosToolbarProps) {
  const { busqueda, onBuscar, filtros, onFiltro } = controles;
  return (
    <BarraHerramientas
      encabezado={
        <CampoBusqueda
          label="Buscar usuarios"
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={onBuscar}
        />
      }
      recuento={
        <>
          <RecuentoItem cantidad={visibles.length} singular="persona" plural="personas" /> ·{' '}
          <RecuentoItem cantidad={contarActivas(visibles)} singular="activa" plural="activas" />
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_ROL}
        value={filtros.rol}
        onChange={(rol) => onFiltro('rol', rol)}
        size="sm"
        aria-label="Filtrar por rol"
      />
      <SegmentedControl
        options={OPCIONES_ESTADO}
        value={filtros.estado}
        onChange={(estado) => onFiltro('estado', estado)}
        size="sm"
        aria-label="Filtrar por estado"
      />
    </BarraHerramientas>
  );
}
