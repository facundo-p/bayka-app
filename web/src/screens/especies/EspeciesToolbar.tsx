import { Search } from 'lucide-react';
import { Input, SegmentedControl, Select } from '../../components';
import { formatearEntero } from '../../lib/formato';
import {
  ORDEN_ESPECIE,
  USO_ESPECIE,
  type OrdenEspecie,
  type UsoEspecie,
} from './filtros';
import styles from './Especies.module.css';

const TAMANO_ICONO = 14;

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
    <div className={styles.toolbar}>
      <div className={styles.busqueda}>
        <Search className={styles.iconoBusqueda} size={TAMANO_ICONO} aria-hidden />
        <Input
          label="Buscar especies"
          labelOculto
          type="search"
          className={styles.inputBusqueda}
          placeholder="Buscar por nombre, código o científico…"
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
        />
      </div>
      <span className={styles.divisor} aria-hidden="true" />
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
      <span className={styles.recuento}>
        <strong className={styles.recuentoNumero}>{formatearEntero(especies)}</strong> especies ·{' '}
        <strong className={styles.recuentoNumero}>{formatearEntero(arboles)}</strong> árboles
      </span>
    </div>
  );
}
