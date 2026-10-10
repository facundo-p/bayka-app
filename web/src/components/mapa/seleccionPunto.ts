/*
 * Qué punto del mapa tiene el popup abierto. Agnóstico del proveedor: el mapa
 * despacha abrir al clickear un punto y cerrar cuando su popup se cierra.
 */
import { useCallback, useReducer, useRef } from 'react';
import type { PuntoGps } from './types';

/** Cada click crea una selección con id propio, aunque sea el mismo punto. */
export interface SeleccionPunto {
  punto: PuntoGps;
  id: number;
}

export type EstadoSeleccion = SeleccionPunto | null;

export const ACCION_SELECCION = { abrir: 'abrir', cerrar: 'cerrar' } as const;

export type AccionSeleccion =
  | { tipo: typeof ACCION_SELECCION.abrir; punto: PuntoGps; id: number }
  | { tipo: typeof ACCION_SELECCION.cerrar; id: number };

/** Cerrar una selección vieja no pisa a la nueva: el id tiene que coincidir. */
export function reducirSeleccion(
  estado: EstadoSeleccion,
  accion: AccionSeleccion,
): EstadoSeleccion {
  if (accion.tipo === ACCION_SELECCION.abrir) return { punto: accion.punto, id: accion.id };
  return estado?.id === accion.id ? null : estado;
}

/** La selección vale mientras su punto siga entre los que muestra el mapa. */
export function seleccionVigente(estado: EstadoSeleccion, puntos: PuntoGps[]): EstadoSeleccion {
  return estado !== null && puntos.includes(estado.punto) ? estado : null;
}

/**
 * Un solo popup para todo el mapa. Clickear el punto del popup abierto hace que
 * Leaflet lo cierre (`preclick`) y enseguida lo vuelva a pedir (`click`): el id
 * nuevo garantiza que el estado cambie y el popup se vuelva a montar.
 */
export function useSeleccionPunto(puntos: PuntoGps[]) {
  const [estado, despachar] = useReducer(reducirSeleccion, null);
  const ultimoId = useRef(0);
  const vigente = seleccionVigente(estado, puntos);
  // Si el filtro deja afuera al punto, la selección se descarta: no reaparece
  // si el punto vuelve a entrar.
  if (estado !== null && vigente === null) {
    despachar({ tipo: ACCION_SELECCION.cerrar, id: estado.id });
  }
  const seleccionar = useCallback((punto: PuntoGps) => {
    ultimoId.current += 1;
    despachar({ tipo: ACCION_SELECCION.abrir, punto, id: ultimoId.current });
  }, []);
  const cerrar = useCallback((id: number) => {
    despachar({ tipo: ACCION_SELECCION.cerrar, id });
  }, []);
  return { seleccion: vigente, seleccionar, cerrar };
}
