import { Button, Input, Select } from '../../components';
import { ESTADO_PLANTACION } from '../../queries/plantationQueries';
import type { FiltrosPlantaciones } from './filtrosPlantaciones';
import styles from './PlantacionesFiltros.module.css';

interface PlantacionesFiltrosProps {
  filtros: FiltrosPlantaciones;
  lugares: string[];
  periodos: string[];
  mostrarLimpiar: boolean;
  onCambiar: (campo: keyof FiltrosPlantaciones, valor: string) => void;
  onLimpiar: () => void;
}

/**
 * Barra de filtros compacta del listado de plantaciones (patrón ArbolesFiltros):
 * Lugar + Período + Estado + rango de fecha, en una fila, combinables (AND).
 * Los Selects de Lugar y Período se ocultan si hay ≤1 valor distinto: filtrar
 * por un único valor no aporta ninguna decisión, así que no se muestra el control.
 * Labels accesibles pero ocultos.
 */
export function PlantacionesFiltros({
  filtros,
  lugares,
  periodos,
  mostrarLimpiar,
  onCambiar,
  onLimpiar,
}: PlantacionesFiltrosProps) {
  return (
    <div className={styles.filtros}>
      {lugares.length > 1 && (
        <Select
          label="Lugar"
          labelOculto
          value={filtros.lugar}
          onChange={(evento) => onCambiar('lugar', evento.target.value)}
        >
          <option value="">Lugar: todos</option>
          {lugares.map((lugar) => (
            <option key={lugar} value={lugar}>
              {lugar}
            </option>
          ))}
        </Select>
      )}
      {periodos.length > 1 && (
        <Select
          label="Período"
          labelOculto
          value={filtros.periodo}
          onChange={(evento) => onCambiar('periodo', evento.target.value)}
        >
          <option value="">Período: todos</option>
          {periodos.map((periodo) => (
            <option key={periodo} value={periodo}>
              {periodo}
            </option>
          ))}
        </Select>
      )}
      <Select
        label="Estado"
        labelOculto
        value={filtros.estado}
        onChange={(evento) => onCambiar('estado', evento.target.value)}
      >
        <option value="">Estado: todos</option>
        <option value={ESTADO_PLANTACION.activa}>Activas</option>
        <option value={ESTADO_PLANTACION.finalizada}>Finalizadas</option>
      </Select>
      <Input
        label="Creada desde"
        labelOculto
        type="date"
        aria-label="Creada desde"
        value={filtros.desde}
        onChange={(evento) => onCambiar('desde', evento.target.value)}
      />
      <Input
        label="Creada hasta"
        labelOculto
        type="date"
        aria-label="Creada hasta"
        value={filtros.hasta}
        onChange={(evento) => onCambiar('hasta', evento.target.value)}
      />
      {mostrarLimpiar && (
        <Button variant="secondary" size="sm" onClick={onLimpiar}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
