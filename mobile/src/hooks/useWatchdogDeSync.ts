import { useEffect, useState, type RefObject } from 'react';

/**
 * Sin ninguna señal de avance durante este rato, se le ofrece cancelar al usuario.
 * Lo que se cronometra es el ESTANCAMIENTO, no la duración: una foto de 4 MB con
 * señal de campo puede tardar dos minutos legítimamente, y abortarla rompe una
 * subida que estaba funcionando (#451).
 */
export const MS_SIN_AVANCE = 45_000;

/** Cada cuánto se revisa. Un segundo alcanza para un umbral de 45. */
const MS_ENTRE_CHEQUEOS = 1_000;

/**
 * `true` cuando la sync lleva `MS_SIN_AVANCE` sin novedades. El watchdog **no
 * cancela solo**: solo habilita el botón. Nada se aborta a espaldas del técnico.
 *
 * Se consulta un ref por reloj en vez de re-armar un timer en cada evento de
 * progreso: los eventos llegan de a cientos en un pull grande.
 */
export function useWatchdogDeSync(activo: boolean, ultimoAvance: RefObject<number>): boolean {
  const [estancado, setEstancado] = useState(false);

  useEffect(() => {
    if (!activo) {
      setEstancado(false);
      return;
    }
    const reloj = setInterval(() => {
      setEstancado(Date.now() - ultimoAvance.current >= MS_SIN_AVANCE);
    }, MS_ENTRE_CHEQUEOS);
    return () => clearInterval(reloj);
  }, [activo, ultimoAvance]);

  return estancado;
}
