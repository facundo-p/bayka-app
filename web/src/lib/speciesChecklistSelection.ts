import type { EspecieCatalogo } from '../queries/especieQueries';

/** Estado tri-estado del checkbox maestro según las filas visibles. */
export type EstadoMaestro = 'todas' | 'ninguna' | 'parcial';

/** Acción masiva a aplicar sobre las especies visibles. */
export type AccionMasiva = 'marcar' | 'desmarcar';

/** Contexto de selección: filas visibles + habilitadas + bloqueadas. */
export interface ContextoSeleccion {
  /** Ids de especies visibles (respeta el filtro de búsqueda activo). */
  idsVisibles: string[];
  /** Ids habilitados en la plantación. */
  habilitadas: Set<string>;
  /** Habilitadas con árboles registrados: no se pueden quitar. */
  bloqueadas: Set<string>;
}

/** Plan puro de una acción masiva: qué agregar/quitar y bloqueadas que quedan. */
export interface PlanSeleccion {
  /** Especies visibles a habilitar. */
  idsHabilitar: string[];
  /** Especies visibles a quitar (nunca incluye bloqueadas). */
  idsQuitar: string[];
  /** Bloqueadas visibles que quedaron habilitadas por tener árboles. */
  bloqueadasMantenidas: number;
}

/** Filtra el catálogo por nombre/código/científico, sin distinguir mayúsculas. */
export function filtrarCatalogo(
  catalogo: EspecieCatalogo[],
  busqueda: string,
): EspecieCatalogo[] {
  const texto = busqueda.trim().toLowerCase();
  if (!texto) return catalogo;
  return catalogo.filter((especie) =>
    [especie.nombre, especie.codigo, especie.nombreCientifico ?? '']
      .join(' ')
      .toLowerCase()
      .includes(texto),
  );
}

/** Tri-estado del maestro según cuántas filas visibles están habilitadas. */
export function estadoMaestro({ idsVisibles, habilitadas }: ContextoSeleccion): EstadoMaestro {
  if (idsVisibles.length === 0) return 'ninguna';
  const marcadas = idsVisibles.filter((id) => habilitadas.has(id)).length;
  if (marcadas === 0) return 'ninguna';
  if (marcadas === idsVisibles.length) return 'todas';
  return 'parcial';
}

/** Un maestro 'todas' desmarca; 'ninguna'/'parcial' marca todo lo visible. */
export function accionDesdeEstado(estado: EstadoMaestro): AccionMasiva {
  return estado === 'todas' ? 'desmarcar' : 'marcar';
}

/** Plan puro de la acción masiva sobre las filas visibles. */
export function planificarAccionMasiva(
  contexto: ContextoSeleccion,
  accion: AccionMasiva,
): PlanSeleccion {
  const { idsVisibles, habilitadas, bloqueadas } = contexto;
  if (accion === 'marcar') {
    return {
      idsHabilitar: idsVisibles.filter((id) => !habilitadas.has(id)),
      idsQuitar: [],
      bloqueadasMantenidas: 0,
    };
  }
  // Desmarcar: quitar las visibles habilitadas salvo las bloqueadas (árboles).
  const idsQuitar = idsVisibles.filter((id) => habilitadas.has(id) && !bloqueadas.has(id));
  const bloqueadasMantenidas = idsVisibles.filter((id) => bloqueadas.has(id)).length;
  return { idsHabilitar: [], idsQuitar, bloqueadasMantenidas };
}

/** Aviso al desmarcar cuando quedaron especies habilitadas por tener árboles. */
export function avisoBloqueadas(cantidad: number): string {
  return cantidad === 1
    ? '1 especie quedó habilitada porque tiene árboles registrados y no se puede quitar.'
    : `${cantidad} especies quedaron habilitadas porque tienen árboles registrados y no se pueden quitar.`;
}
