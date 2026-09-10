import { useCallback, useEffect, useState } from 'react';
import { TECLA } from '../lib/teclas';

type Movimiento = (actual: number, cantidad: number) => number;

const MOVIMIENTOS: Partial<Record<string, Movimiento>> = {
  [TECLA.abajo]: (actual, cantidad) => (actual + 1) % cantidad,
  [TECLA.arriba]: (actual, cantidad) => (actual - 1 + cantidad) % cantidad,
  [TECLA.inicio]: () => 0,
  [TECLA.fin]: (_actual, cantidad) => cantidad - 1,
};

/** Resaltado de una lista plana: flechas con wrap, Home/End a los extremos y Enter elige. */
export function useNavegacionTeclado(cantidad: number, alElegir: (indice: number) => void) {
  const [resaltado, setResaltado] = useState(0);
  useEffect(() => setResaltado(0), [cantidad]);
  const alPresionar = useCallback(
    (evento: React.KeyboardEvent) => {
      if (cantidad === 0) return;
      const mover = MOVIMIENTOS[evento.key];
      if (mover) {
        evento.preventDefault();
        setResaltado((previo) => mover(previo, cantidad));
      } else if (evento.key === TECLA.enter) {
        evento.preventDefault();
        alElegir(resaltado);
      }
    },
    [cantidad, resaltado, alElegir],
  );
  return { resaltado, setResaltado, alPresionar };
}
