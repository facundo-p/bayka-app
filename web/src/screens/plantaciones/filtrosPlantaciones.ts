import { formatearEntero } from '../../lib/formato';
import type { PlantacionConStats } from '../../queries/plantationQueries';

/** Valores de estado seleccionables ('' = todas). */
export const ESTADO_ACTIVA = 'activa';
export const ESTADO_FINALIZADA = 'finalizada';

/**
 * Estado de los filtros tal como vive en los controles ('' = sin filtro).
 * `desde`/`hasta` son fechas 'YYYY-MM-DD' de los <input type="date">.
 */
export type FiltrosPlantaciones = {
  lugar: string;
  periodo: string;
  estado: string;
  desde: string;
  hasta: string;
};

export const FILTROS_PLANTACIONES_INICIALES: FiltrosPlantaciones = {
  lugar: '',
  periodo: '',
  estado: '',
  desde: '',
  hasta: '',
};

/** Valores distintos, no vacíos, ordenados alfabéticamente (es-AR). */
function distintosOrdenados(valores: string[]): string[] {
  const unicos = new Set(valores.filter((valor) => valor !== ''));
  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Lugares presentes en el dataset (para poblar el Select de Lugar). */
export function lugaresDisponibles(plantaciones: PlantacionConStats[]): string[] {
  return distintosOrdenados(plantaciones.map((plantacion) => plantacion.lugar));
}

/** Períodos/temporadas presentes en el dataset (para el Select de Período). */
export function periodosDisponibles(plantaciones: PlantacionConStats[]): string[] {
  return distintosOrdenados(plantaciones.map((plantacion) => plantacion.periodo));
}

/** True si al menos un filtro está activo (para mostrar "Limpiar" y el rótulo). */
export function hayFiltrosActivos(filtros: FiltrosPlantaciones): boolean {
  return Boolean(
    filtros.lugar || filtros.periodo || filtros.estado || filtros.desde || filtros.hasta,
  );
}

/**
 * Filtra plantaciones combinando lugar + período + estado + fecha (AND).
 * Función PURA: no depende de React ni de queries; testeable sin render.
 *
 * La fecha se compara contra `createdAt` (columna "Creada"), el único campo de
 * fecha garantizado en toda fila. `fechaInicio` puede ser null si la migración
 * 024 no está aplicada, por eso NO se usa como eje de filtrado.
 * Un rango invertido (desde > hasta) no matchea ninguna fila → 0 resultados.
 */
export function filtrarPlantaciones(
  plantaciones: PlantacionConStats[],
  filtros: FiltrosPlantaciones,
): PlantacionConStats[] {
  return plantaciones.filter((plantacion) => {
    if (filtros.lugar && plantacion.lugar !== filtros.lugar) return false;
    if (filtros.periodo && plantacion.periodo !== filtros.periodo) return false;
    if (filtros.estado && plantacion.estado !== filtros.estado) return false;
    // createdAt es ISO ('YYYY-MM-DDTHH:mm:ssZ'); la porción de fecha se compara
    // lexicográficamente contra 'YYYY-MM-DD' (ambos ordenan igual como texto).
    const fecha = plantacion.createdAt.slice(0, 10);
    if (filtros.desde && fecha < filtros.desde) return false;
    if (filtros.hasta && fecha > filtros.hasta) return false;
    return true;
  });
}

/** Subtítulo: N plantaciones · M temporadas distintas · TOTAL árboles. */
export function resumenPlantaciones(plantaciones: PlantacionConStats[]): string {
  const temporadas = new Set(plantaciones.map((plantacion) => plantacion.periodo)).size;
  const totalArboles = plantaciones.reduce((suma, plantacion) => suma + plantacion.arboles, 0);
  return `${plantaciones.length} plantaciones · ${temporadas} temporadas · ${formatearEntero(totalArboles)} árboles registrados`;
}
