import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoNumero,
  SegmentedControl,
} from '../../components';
import {
  FILTRO_ESTADO,
  FILTRO_ROL,
  type FiltroEstado,
  type FiltroRol,
} from './filtros';

const OPCIONES_ROL: Array<{ value: FiltroRol; label: string }> = [
  { value: FILTRO_ROL.todos, label: 'Rol: todos' },
  { value: FILTRO_ROL.admins, label: 'Admins' },
  { value: FILTRO_ROL.tecnicos, label: 'Técnicos' },
];

const OPCIONES_ESTADO: Array<{ value: FiltroEstado; label: string }> = [
  { value: FILTRO_ESTADO.todos, label: 'Estado: todos' },
  { value: FILTRO_ESTADO.activos, label: 'Activos' },
  { value: FILTRO_ESTADO.inactivos, label: 'Inactivos' },
];

interface UsuariosToolbarProps {
  busqueda: string;
  rol: FiltroRol;
  estado: FiltroEstado;
  onBuscar: (texto: string) => void;
  onRol: (rol: FiltroRol) => void;
  onEstado: (estado: FiltroEstado) => void;
  /** Personas visibles y cuántas de ellas están activas. */
  personas: number;
  activas: number;
}

/** Toolbar de Usuarios: búsqueda, rol, estado y recuento, un solo renglón. */
export function UsuariosToolbar({
  busqueda,
  rol,
  estado,
  onBuscar,
  onRol,
  onEstado,
  personas,
  activas,
}: UsuariosToolbarProps) {
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
          <RecuentoNumero>{personas}</RecuentoNumero>{' '}
          {personas === 1 ? 'persona' : 'personas'} ·{' '}
          <RecuentoNumero>{activas}</RecuentoNumero> {activas === 1 ? 'activa' : 'activas'}
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_ROL}
        value={rol}
        onChange={onRol}
        size="sm"
        aria-label="Filtrar por rol"
      />
      <SegmentedControl
        options={OPCIONES_ESTADO}
        value={estado}
        onChange={onEstado}
        size="sm"
        aria-label="Filtrar por estado"
      />
    </BarraHerramientas>
  );
}
