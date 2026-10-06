import { useState } from 'react';
import {
  alternarId,
  aplicarMaestro,
  estadoMaestro,
  marcadasEnOrden,
} from '../../lib/seleccionMaestro';
import { descargarFichasPdf, type ContextoFichasPdf } from '../../services/pdfFichas';

const NINGUNA: ReadonlySet<string> = new Set();

/**
 * La marca se guarda junto a la clave de la página. Con otra página u otros
 * filtros se descarta en el mismo render, así no reaparece al volver.
 */
function useMarcadasDePagina(clavePagina: string) {
  const [guardadas, setGuardadas] = useState({ clave: clavePagina, ids: NINGUNA });
  const vigente = guardadas.clave === clavePagina;
  if (!vigente) setGuardadas({ clave: clavePagina, ids: NINGUNA });
  const marcadas = vigente ? guardadas.ids : NINGUNA;
  const fijar = (ids: ReadonlySet<string>) => setGuardadas({ clave: clavePagina, ids });
  return { marcadas, fijar };
}

/** Modo selección sobre los árboles de la página a la vista, en su orden. */
function useSeleccionDePagina(clavePagina: string, idsPagina: readonly string[]) {
  const [activa, setActiva] = useState(false);
  // Al cancelar, el foco vuelve a «Seleccionar»; al cargar la pantalla, no.
  const [recienCancelada, setRecienCancelada] = useState(false);
  const { marcadas, fijar } = useMarcadasDePagina(clavePagina);
  const ids = marcadasEnOrden(idsPagina, marcadas);
  return {
    activa,
    recienCancelada,
    ids,
    totalPagina: idsPagina.length,
    maestro: estadoMaestro(idsPagina, marcadas),
    estaMarcado: (id: string) => ids.includes(id),
    entrar: () => setActiva(true),
    cancelar: () => {
      setActiva(false);
      setRecienCancelada(true);
      fijar(NINGUNA);
    },
    alternar: (id: string) => fijar(alternarId(marcadas, id)),
    alternarTodos: () => fijar(aplicarMaestro(idsPagina, marcadas)),
  };
}

/**
 * Selección de árboles para las fichas PDF (#755). `generar` es null (botón
 * deshabilitado) sin nada marcado o sin el contexto de la plantación.
 */
export function useSeleccionFichas(
  clavePagina: string,
  idsPagina: readonly string[],
  contexto: ContextoFichasPdf | null,
) {
  const seleccion = useSeleccionDePagina(clavePagina, idsPagina);
  const { ids } = seleccion;
  const generar = contexto && ids.length > 0 ? () => descargarFichasPdf(ids, contexto) : null;
  return { ...seleccion, generar };
}

export type SeleccionFichas = ReturnType<typeof useSeleccionFichas>;
