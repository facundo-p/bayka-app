import { Search } from 'lucide-react';
import { Input, SegmentedControl } from '../../components';
import {
  FILTRO_ESTADO,
  FILTRO_ROL,
  type FiltroEstado,
  type FiltroRol,
} from './filtros';
import styles from './Usuarios.module.css';

const TAMANO_ICONO = 14;

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
    <div className={styles.toolbar}>
      <div className={styles.busqueda}>
        <Search className={styles.iconoBusqueda} size={TAMANO_ICONO} aria-hidden />
        <Input
          label="Buscar usuarios"
          labelOculto
          type="search"
          className={styles.inputBusqueda}
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
        />
      </div>
      <span className={styles.divisor} aria-hidden="true" />
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
      <span className={styles.recuento}>
        <strong className={styles.recuentoNumero}>{personas}</strong>{' '}
        {personas === 1 ? 'persona' : 'personas'} ·{' '}
        <strong className={styles.recuentoNumero}>{activas}</strong>{' '}
        {activas === 1 ? 'activa' : 'activas'}
      </span>
    </div>
  );
}
