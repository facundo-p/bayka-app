import { Search } from 'lucide-react';
import { Input, SegmentedControl, Select } from '../../components';
import { formatearEntero } from '../../lib/formato';
import {
  FILTRO_ESTADO,
  ORDEN_PLANTACION,
  TEMPORADA_TODAS,
  type FiltroEstado,
  type OrdenPlantacion,
} from './filtros';
import styles from './Plantaciones.module.css';

const TAMANO_ICONO = 14;

const OPCIONES_ESTADO: Array<{ value: FiltroEstado; label: string }> = [
  { value: FILTRO_ESTADO.todas, label: 'Todas' },
  { value: FILTRO_ESTADO.activas, label: 'Activas' },
  { value: FILTRO_ESTADO.finalizadas, label: 'Finalizadas' },
];

const OPCIONES_ORDEN: Array<{ value: OrdenPlantacion; label: string }> = [
  { value: ORDEN_PLANTACION.arboles, label: 'Orden: árboles ↓' },
  { value: ORDEN_PLANTACION.lugar, label: 'Orden: lugar A-Z' },
  { value: ORDEN_PLANTACION.creada, label: 'Orden: creada ↓' },
];

interface PlantacionesToolbarProps {
  busqueda: string;
  estado: FiltroEstado;
  temporada: string;
  orden: OrdenPlantacion;
  onBuscar: (texto: string) => void;
  onEstado: (estado: FiltroEstado) => void;
  onTemporada: (temporada: string) => void;
  onOrden: (orden: OrdenPlantacion) => void;
  /** Temporadas del dataset completo, para poblar el Select. */
  temporadas: string[];
  /** Plantaciones visibles y sus árboles, tras aplicar los filtros. */
  plantaciones: number;
  arboles: number;
}

/** Toolbar de Plantaciones: búsqueda, estado, temporada, orden y recuento. */
export function PlantacionesToolbar({
  busqueda,
  estado,
  temporada,
  orden,
  onBuscar,
  onEstado,
  onTemporada,
  onOrden,
  temporadas,
  plantaciones,
  arboles,
}: PlantacionesToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.busqueda}>
        <Search className={styles.iconoBusqueda} size={TAMANO_ICONO} aria-hidden />
        <Input
          label="Buscar plantaciones"
          labelOculto
          type="search"
          className={styles.inputBusqueda}
          placeholder="Buscar por lugar o temporada…"
          value={busqueda}
          onChange={(evento) => onBuscar(evento.target.value)}
        />
      </div>
      <span className={styles.divisor} aria-hidden="true" />
      <SegmentedControl
        options={OPCIONES_ESTADO}
        value={estado}
        onChange={onEstado}
        size="sm"
        aria-label="Filtrar por estado"
      />
      {/* Filtrar por una única temporada no aporta ninguna decisión. */}
      {temporadas.length > 1 && (
        <Select
          label="Filtrar por temporada"
          labelOculto
          className={styles.temporadaSelect}
          value={temporada}
          onChange={(evento) => onTemporada(evento.target.value)}
        >
          <option value={TEMPORADA_TODAS}>Temporada: todas</option>
          {temporadas.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </Select>
      )}
      <Select
        label="Ordenar plantaciones"
        labelOculto
        className={styles.orden}
        value={orden}
        onChange={(evento) => onOrden(evento.target.value as OrdenPlantacion)}
      >
        {OPCIONES_ORDEN.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <span className={styles.recuento}>
        <strong className={styles.recuentoNumero}>{formatearEntero(plantaciones)}</strong>{' '}
        {plantaciones === 1 ? 'plantación' : 'plantaciones'} ·{' '}
        <strong className={styles.recuentoNumero}>{formatearEntero(arboles)}</strong> árboles
      </span>
    </div>
  );
}
