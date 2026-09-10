import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useCerrarAfuera } from '../../hooks/useCerrarAfuera';
import { useListboxNavegable } from '../../hooks/useListboxNavegable';
import { usePosicionAnclada } from '../../hooks/usePosicionAnclada';
import { TECLA } from '../../lib/teclas';
import { filtrarOpciones, type OpcionConDetalle } from './opcionesConDetalle';

const TECLAS_ABRIR: ReadonlySet<string> = new Set([TECLA.abajo, TECLA.arriba]);

type EventoTeclado = KeyboardEvent<HTMLElement>;

export interface ValorSelect {
  value: string;
  onChange: (valor: string) => void;
  opciones: OpcionConDetalle[];
}

type Apertura = ReturnType<typeof useApertura>;
export type Desplegable = ReturnType<typeof useDesplegable>;

function useIds() {
  const base = useId();
  return { label: `${base}-label`, disparador: `${base}-disparador`, valor: `${base}-valor` };
}

/** Cerrar descarta lo tipeado: al reabrir se ven todas las opciones. */
function useApertura() {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const refDisparador = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda('');
  }, []);
  const cerrarYEnfocar = () => {
    cerrar();
    refDisparador.current?.focus();
  };
  return { abierto, setAbierto, busqueda, setBusqueda, refDisparador, cerrar, cerrarYEnfocar };
}

/** Elegir cierra y devuelve el foco al disparador; abrir resalta la opción elegida. */
function useSeleccion({ opciones, value, onChange }: ValorSelect, apertura: Apertura) {
  const filtradas = filtrarOpciones(opciones, apertura.busqueda);
  const esElegida = (opcion: OpcionConDetalle) => opcion.valor === value;
  const elegir = (indice: number) => {
    const opcion = filtradas[indice];
    if (!opcion) return;
    onChange(opcion.valor);
    apertura.cerrarYEnfocar();
  };
  const listbox = useListboxNavegable(filtradas.length, elegir);
  const abrir = () => {
    apertura.setAbierto(true);
    listbox.setResaltado(Math.max(0, opciones.findIndex(esElegida)));
  };
  return { filtradas, elegida: opciones.find(esElegida), esElegida, elegir, abrir, listbox };
}

function usePopover({ abierto, cerrar, refDisparador }: Apertura) {
  const refPopover = useRef<HTMLDivElement>(null);
  useCerrarAfuera(abierto, cerrar, refDisparador, refPopover);
  const posicion = usePosicionAnclada(abierto, refDisparador);
  return { refPopover, posicion };
}

function teclaEnDisparador(evento: EventoTeclado, abierto: boolean, abrir: () => void) {
  if (abierto || !TECLAS_ABRIR.has(evento.key)) return;
  evento.preventDefault();
  abrir();
}

function teclaEnBuscador(
  evento: EventoTeclado,
  cerrarYEnfocar: () => void,
  navegar: (evento: EventoTeclado) => void,
) {
  if (evento.key === TECLA.escape) {
    // Cierra solo la lista: sin esto el Escape también cierra el modal.
    evento.stopPropagation();
    cerrarYEnfocar();
  } else if (evento.key === TECLA.tab) {
    // Sin preventDefault: el Tab sigue desde el disparador al próximo control.
    cerrarYEnfocar();
  } else {
    navegar(evento);
  }
}

/** Estado del selector: apertura, búsqueda, resaltado, popover y teclado. */
export function useDesplegable(valor: ValorSelect) {
  const ids = useIds();
  const apertura = useApertura();
  const seleccion = useSeleccion(valor, apertura);
  const popover = usePopover(apertura);
  return {
    ...apertura,
    ...seleccion,
    ...popover,
    ids,
    sinOpciones: valor.opciones.length === 0,
    alTeclearDisparador: (evento: EventoTeclado) =>
      teclaEnDisparador(evento, apertura.abierto, seleccion.abrir),
    alTeclearBuscador: (evento: EventoTeclado) =>
      teclaEnBuscador(evento, apertura.cerrarYEnfocar, seleccion.listbox.alPresionar),
  };
}
