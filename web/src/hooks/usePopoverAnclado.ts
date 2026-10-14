import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { focoPerdido, tabulables } from '../lib/foco';
import { cerrarSoloEstaCapa } from '../lib/escape';
import { useDesplegableAnclado } from './useDesplegableAnclado';
import { MARGEN_VIEWPORT } from './usePosicionAnclada';

/** Qué borde del panel se alinea con el mismo borde de su disparador. */
export const LADO_PANEL = {
  izquierda: 'izquierda',
  derecha: 'derecha',
} as const;

export type LadoPanel = (typeof LADO_PANEL)[keyof typeof LADO_PANEL];

export interface UbicacionPanel {
  lado: LadoPanel;
  /** px hacia la derecha, cuando el panel tampoco entra alineado por la derecha. */
  desvio: number;
}

/** Borde izquierdo con el del disparador: se abre hacia la derecha. */
const ALINEADO_IZQUIERDA: UbicacionPanel = { lado: LADO_PANEL.izquierda, desvio: 0 };

/**
 * Se abre hacia la derecha del disparador si ahí entra; si no, hacia la
 * izquierda, y si tampoco entra, se corre lo justo para dejar el margen.
 */
export function ubicarPanel(
  disparador: Pick<DOMRect, 'left' | 'right'>,
  anchoPanel: number,
  anchoVentana: number,
): UbicacionPanel {
  if (disparador.left + anchoPanel <= anchoVentana - MARGEN_VIEWPORT) return ALINEADO_IZQUIERDA;
  const bordeIzquierdo = disparador.right - anchoPanel;
  return { lado: LADO_PANEL.derecha, desvio: Math.max(0, MARGEN_VIEWPORT - bordeIzquierdo) };
}

type Ref<T extends HTMLElement> = RefObject<T | null>;

/** `clientWidth` y no `innerWidth`: la barra de scroll también tapa. */
function medirUbicacion(disparador: HTMLElement, panel: HTMLElement): UbicacionPanel {
  const anchoVentana = document.documentElement.clientWidth;
  return ubicarPanel(disparador.getBoundingClientRect(), panel.offsetWidth, anchoVentana);
}

/** Mide antes de pintar, así el panel nunca se ve un instante desbordado. */
function useUbicacion(abierto: boolean, disparador: Ref<HTMLElement>, panel: Ref<HTMLElement>) {
  const [ubicacion, setUbicacion] = useState(ALINEADO_IZQUIERDA);
  useLayoutEffect(() => {
    if (!abierto) return;
    function medir() {
      if (disparador.current && panel.current) {
        setUbicacion(medirUbicacion(disparador.current, panel.current));
      }
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [abierto, disparador, panel]);
  return ubicacion;
}

function enfocarPrimero(panel: Ref<HTMLElement>) {
  if (panel.current) tabulables(panel.current)[0]?.focus();
}

function useFocoInicial(abierto: boolean, panel: Ref<HTMLElement>) {
  useEffect(() => {
    if (abierto) enfocarPrimero(panel);
  }, [abierto, panel]);
}

/**
 * Al cerrar, el foco vuelve al disparador si quedó en ningún lado. Espera una
 * vuelta: un clic afuera mueve el foco después del mousedown que cerró, y si
 * cayó en otro control, ahí se queda.
 */
function useDevolverFoco(abierto: boolean, disparador: Ref<HTMLElement>) {
  const estuvoAbierto = useRef(false);
  useEffect(() => {
    if (abierto) {
      estuvoAbierto.current = true;
      return;
    }
    if (!estuvoAbierto.current) return;
    estuvoAbierto.current = false;
    const espera = setTimeout(() => {
      if (focoPerdido()) disparador.current?.focus();
    });
    return () => clearTimeout(espera);
  }, [abierto, disparador]);
}

/** Los cierres que llegan por teclado al contenedor: Escape, y el Tab que sale de él. */
function cierresPorTeclado(cerrar: () => void, contenedor: Ref<HTMLElement>) {
  return {
    alTeclear: (evento: KeyboardEvent) => {
      cerrarSoloEstaCapa(evento, cerrar);
    },
    alPerderFoco: (evento: FocusEvent) => {
      const destino = evento.relatedTarget;
      if (destino instanceof Node && !contenedor.current?.contains(destino)) cerrar();
    },
  };
}

/**
 * Popover no modal anclado a un botón: abre con el foco en su primer control,
 * cierra con Escape, con un clic afuera o cuando el Tab sale de él, y se abre
 * hacia el lado donde entra en la ventana, o corrido si no entra en ninguno.
 */
export function usePopoverAnclado() {
  const { abierto, cerrar, alternar, contenedorRef } = useDesplegableAnclado();
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const ubicacion = useUbicacion(abierto, disparadorRef, panelRef);
  useFocoInicial(abierto, panelRef);
  useDevolverFoco(abierto, disparadorRef);
  const refs = { contenedor: contenedorRef, disparador: disparadorRef, panel: panelRef };
  return {
    abierto,
    alternar,
    ubicacion,
    idPanel,
    refs,
    enfocarPrimero: () => enfocarPrimero(panelRef),
    ...cierresPorTeclado(cerrar, contenedorRef),
  };
}
