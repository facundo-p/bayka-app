/**
 * Quién se come el inset de la status bar. Arriba del navigator puede haber hasta
 * dos franjas (entorno de pruebas, aviso de OTA) y abajo de ellas el header: el
 * inset lo aplica el primero que esté presente, y los de abajo lo dejan en 0 o
 * queda una franja vacía.
 *
 * La franja de entorno es una constante de build, pero el aviso de OTA aparece y
 * desaparece en runtime: por eso la regla no puede vivir en cada componente.
 */
import { createContext } from 'react';

export const OCUPANTE_DEL_INSET = {
  entorno: 'entorno',
  aviso: 'aviso',
  header: 'header',
} as const;

export type OcupanteDelInset = (typeof OCUPANTE_DEL_INSET)[keyof typeof OCUPANTE_DEL_INSET];

export function ocupanteDelInsetSuperior(
  hayFranjaDeEntorno: boolean,
  hayAvisoDeActualizacion: boolean,
): OcupanteDelInset {
  if (hayFranjaDeEntorno) return OCUPANTE_DEL_INSET.entorno;
  if (hayAvisoDeActualizacion) return OCUPANTE_DEL_INSET.aviso;
  return OCUPANTE_DEL_INSET.header;
}

/**
 * Lo provee `FranjasSuperiores`. El default `false` es el estado normal —y el que
 * ven los tests que renderizan un header suelto—: sin aviso arriba, el header se
 * come el inset como siempre.
 */
export const InsetSuperiorContexto = createContext({ hayAvisoDeActualizacion: false });
