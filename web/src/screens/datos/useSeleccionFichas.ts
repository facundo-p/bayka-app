import { useState } from 'react';
import {
  alternarId,
  aplicarMaestro,
  estadoMaestro,
  marcadasEnOrden,
} from '../../lib/seleccionMaestro';
import { descargarFichasPdf, type ContextoFichasPdf } from '../../services/pdfFichas';

const NINGUNA: ReadonlySet<string> = new Set();

/** Control que toma el foco al montarse: la franja al entrar, el botón «PDF» al salir. */
export const FOCO_SELECCION = { franja: 'franja', seleccionar: 'seleccionar' } as const;
type FocoSeleccion = (typeof FOCO_SELECCION)[keyof typeof FOCO_SELECCION];

/** Modo activo y a dónde va el foco. El pedido se baja al enfocar (`focoTomado`). */
function useModoSeleccion() {
  const [activa, setActiva] = useState(false);
  const [foco, setFoco] = useState<FocoSeleccion | null>(null);
  const cambiar = (proxima: boolean, destino: FocoSeleccion) => {
    setActiva(proxima);
    setFoco(destino);
  };
  return {
    activa,
    focoEnFranja: foco === FOCO_SELECCION.franja,
    focoEnSeleccionar: foco === FOCO_SELECCION.seleccionar,
    focoTomado: () => setFoco(null),
    entrar: () => cambiar(true, FOCO_SELECCION.franja),
    salir: () => cambiar(false, FOCO_SELECCION.seleccionar),
  };
}

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

/** Marcas sobre los árboles de la página a la vista, en su orden. Un id ajeno no se marca. */
function useMarcasDePagina(clavePagina: string, idsPagina: readonly string[]) {
  const { marcadas, fijar } = useMarcadasDePagina(clavePagina);
  const ids = marcadasEnOrden(idsPagina, marcadas);
  return {
    ids,
    totalPagina: idsPagina.length,
    maestro: estadoMaestro(idsPagina, marcadas),
    estaMarcado: (id: string) => ids.includes(id),
    alternar: (id: string) => {
      if (idsPagina.includes(id)) fijar(alternarId(marcadas, id));
    },
    alternarTodos: () => fijar(aplicarMaestro(idsPagina, marcadas)),
    limpiar: () => fijar(NINGUNA),
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
  const { salir, ...modo } = useModoSeleccion();
  const { limpiar, ...marcas } = useMarcasDePagina(clavePagina, idsPagina);
  const { ids } = marcas;
  const cancelar = () => {
    salir();
    limpiar();
  };
  const generar = contexto && ids.length > 0 ? () => descargarFichasPdf(ids, contexto) : null;
  return { ...modo, ...marcas, cancelar, generar };
}

export type SeleccionFichas = ReturnType<typeof useSeleccionFichas>;
