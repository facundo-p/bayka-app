import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoItem,
  SegmentedControl,
  type Opcion,
} from '../../components';
import type { ControlesFiltros } from '../../hooks/useFiltrosListado';
import type { Sustantivo } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import {
  contarActivas,
  FILTRO_ESTADO,
  FILTRO_ROL,
  type FiltroEstado,
  type FiltroRol,
  type FiltrosBarraUsuarios,
} from './filtros';

const ACTIVA: Sustantivo = { singular: 'activa', plural: 'activas' };

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

type ControlesUsuarios = ControlesFiltros<FiltrosBarraUsuarios>;

interface UsuariosToolbarProps {
  controles: ControlesUsuarios;
  /** Las personas que pasan los filtros: de ellas sale el recuento. */
  visibles: UsuarioConAsignaciones[];
}

function RecuentoUsuarios({ visibles }: { visibles: UsuarioConAsignaciones[] }) {
  return (
    <>
      <RecuentoItem cantidad={visibles.length} sustantivo={SUSTANTIVO.persona} /> ·{' '}
      <RecuentoItem cantidad={contarActivas(visibles)} sustantivo={ACTIVA} />
    </>
  );
}

function FiltrosUsuarios({ controles }: { controles: ControlesUsuarios }) {
  return (
    <>
      <SegmentedControl
        options={OPCIONES_ROL}
        value={controles.filtros.rol}
        onChange={(rol) => controles.onFiltro('rol', rol)}
        size="sm"
        aria-label="Filtrar por rol"
      />
      <SegmentedControl
        options={OPCIONES_ESTADO}
        value={controles.filtros.estado}
        onChange={(estado) => controles.onFiltro('estado', estado)}
        size="sm"
        aria-label="Filtrar por estado"
      />
    </>
  );
}

/** Toolbar de Usuarios: búsqueda, rol, estado y recuento, un solo renglón. */
export function UsuariosToolbar({ controles, visibles }: UsuariosToolbarProps) {
  return (
    <BarraHerramientas
      encabezado={
        <CampoBusqueda
          label="Buscar usuarios"
          placeholder="Buscar por nombre o email…"
          value={controles.busqueda}
          onChange={controles.onBuscar}
        />
      }
      recuento={<RecuentoUsuarios visibles={visibles} />}
    >
      <FiltrosUsuarios controles={controles} />
    </BarraHerramientas>
  );
}
