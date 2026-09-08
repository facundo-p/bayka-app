import {
  BarraHerramientas,
  CampoBusqueda,
  RecuentoNumero,
  SegmentedControl,
  Select,
} from '../../components';
import { formatearEntero } from '../../lib/formato';
import {
  ORDEN_ESPECIE,
  USO_ESPECIE,
  type OrdenEspecie,
  type UsoEspecie,
} from './filtros';
import styles from './Especies.module.css';

const OPCIONES_USO: Array<{ value: UsoEspecie; label: string }> = [
  { value: USO_ESPECIE.todas, label: 'Todas' },
  { value: USO_ESPECIE.enUso, label: 'En uso' },
  { value: USO_ESPECIE.sinUso, label: 'Sin uso' },
];

const OPCIONES_ORDEN: Array<{ value: OrdenEspecie; label: string }> = [
  { value: ORDEN_ESPECIE.arboles, label: 'Orden: árboles ↓' },
  { value: ORDEN_ESPECIE.plantaciones, label: 'Orden: plantaciones ↓' },
  { value: ORDEN_ESPECIE.codigo, label: 'Orden: código A-Z' },
];

interface EspeciesToolbarProps {
  busqueda: string;
  uso: UsoEspecie;
  orden: OrdenEspecie;
  onBuscar: (texto: string) => void;
  onUso: (uso: UsoEspecie) => void;
  onOrden: (orden: OrdenEspecie) => void;
  /** Especies visibles y sus árboles, tras aplicar los filtros. */
  especies: number;
  arboles: number;
}

/** Toolbar de Especies: búsqueda, filtro de uso, orden y recuento, un renglón. */
export function EspeciesToolbar({
  busqueda,
  uso,
  orden,
  onBuscar,
  onUso,
  onOrden,
  especies,
  arboles,
}: EspeciesToolbarProps) {
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
          <RecuentoNumero>{formatearEntero(especies)}</RecuentoNumero> especies ·{' '}
          <RecuentoNumero>{formatearEntero(arboles)}</RecuentoNumero> árboles
        </>
      }
    >
      <SegmentedControl
        options={OPCIONES_USO}
        value={uso}
        onChange={onUso}
        size="sm"
        aria-label="Filtrar por uso"
      />
      <Select
        label="Ordenar especies"
        labelOculto
        className={styles.orden}
        value={orden}
        onChange={(evento) => onOrden(evento.target.value as OrdenEspecie)}
      >
        {OPCIONES_ORDEN.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </BarraHerramientas>
  );
}
