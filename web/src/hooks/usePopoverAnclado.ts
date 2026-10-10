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
import { TECLA } from '../lib/teclas';
import { useDesplegableAnclado } from './useDesplegableAnclado';
import { MARGEN_VIEWPORT } from './usePosicionAnclada';

/** Qué borde del panel se alinea con el mismo borde de su disparador. */
export const LADO_PANEL = {
  izquierda: 'izquierda',
  derecha: 'derecha',
} as const;

export type LadoPanel = (typeof LADO_PANEL)[keyof typeof LADO_PANEL];

/** Se abre hacia la derecha del disparador si ahí entra; si no, hacia la izquierda. */
export function ladoQueEntra(
  disparador: Pick<DOMRect, 'left'>,
  anchoPanel: number,
  anchoVentana: number,
): LadoPanel {
  const entra = disparador.left + anchoPanel <= anchoVentana - MARGEN_VIEWPORT;
  return entra ? LADO_PANEL.izquierda : LADO_PANEL.derecha;
}

type Ref<T extends HTMLElement> = RefObject<T | null>;

/** `clientWidth` y no `innerWidth`: la barra de scroll también tapa. */
function medirLado(disparador: HTMLElement, panel: HTMLElement): LadoPanel {
  const anchoVentana = document.documentElement.clientWidth;
  return ladoQueEntra(disparador.getBoundingClientRect(), panel.offsetWidth, anchoVentana);
}

/** Mide antes de pintar, así el panel nunca se ve un instante desbordado. */
function useLado(abierto: boolean, disparador: Ref<HTMLElement>, panel: Ref<HTMLElement>) {
  const [lado, setLado] = useState<LadoPanel>(LADO_PANEL.izquierda);
  useLayoutEffect(() => {
    if (!abierto) return;
    function medir() {
      if (disparador.current && panel.current) {
        setLado(medirLado(disparador.current, panel.current));
      }
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [abierto, disparador, panel]);
  return lado;
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
    // Detiene el Escape acá: si no, también cerraría el panel de detalle de atrás.
    alTeclear: (evento: KeyboardEvent) => {
      if (evento.key !== TECLA.escape) return;
      evento.stopPropagation();
      cerrar();
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
 * hacia el lado donde entra en la ventana.
 */
export function usePopoverAnclado() {
  const { abierto, cerrar, alternar, contenedorRef } = useDesplegableAnclado();
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const lado = useLado(abierto, disparadorRef, panelRef);
  useFocoInicial(abierto, panelRef);
  useDevolverFoco(abierto, disparadorRef);
  const refs = { contenedor: contenedorRef, disparador: disparadorRef, panel: panelRef };
  return {
    abierto,
    alternar,
    lado,
    idPanel,
    refs,
    enfocarPrimero: () => enfocarPrimero(panelRef),
    ...cierresPorTeclado(cerrar, contenedorRef),
  };
}
